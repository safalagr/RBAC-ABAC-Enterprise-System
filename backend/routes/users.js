import express from 'express';
import { Op } from 'sequelize';
import { User, Role, Permission } from '../models/index.js';
import { authenticate, authorize, enforcePolicy } from '../middleware/auth.js';
import { logAudit } from '../middleware/auditLogger.js';

const router = express.Router();

// Helper to extract user resource attributes for ABAC evaluation
const getUserResourceAttributes = async (req) => {
  const targetUser = await User.findByPk(req.params.id, {
    include: [{ model: Role, as: 'roles' }]
  });
  if (!targetUser) return null;

  const targetMaxLevel = (targetUser.roles || []).reduce((max, r) => Math.max(max, r.level || 0), 0);

  return {
    type: 'user',
    id: targetUser.id,
    department: targetUser.department,
    clearanceLevel: targetUser.clearanceLevel,
    targetLevel: targetMaxLevel
  };
};

// Get all users (ABAC scoped: Admin sees all, Manager sees department, Employee sees self)
router.get('/',
  authenticate,
  authorize('read:users'),
  logAudit('view_users', 'users'),
  async (req, res) => {
    try {
      const isSuperAdmin = req.user.maxRoleLevel >= 100 || (req.user.roles && req.user.roles.some(r => r.name === 'Admin'));
      const isManager = req.user.maxRoleLevel >= 50;

      let whereClause = {};

      if (isSuperAdmin) {
        whereClause = {}; // Full enterprise visibility
      } else if (isManager && req.user.department) {
        whereClause = { department: req.user.department }; // Department boundary scoping
      } else {
        whereClause = { id: req.user.id }; // Self-service ownership scoping
      }

      const users = await User.findAll({
        where: whereClause,
        include: [{
          model: Role,
          as: 'roles',
          attributes: ['id', 'name', 'level', 'description']
        }],
        attributes: { exclude: ['password'] },
        order: [['id', 'ASC']]
      });

      res.json({
        success: true,
        count: users.length,
        scopingApplied: isSuperAdmin ? 'All Organizations/Departments' : (isManager ? `Department: ${req.user.department}` : 'Self Only'),
        users
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users',
        error: error.message
      });
    }
  }
);

// Get single user (Protected by ABAC self, department, or admin policy)
router.get('/:id',
  authenticate,
  authorize('read:users'),
  enforcePolicy('user', 'read', getUserResourceAttributes),
  async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id, {
        include: [{
          model: Role,
          as: 'roles',
          include: [{
            model: Permission,
            as: 'permissions'
          }]
        }],
        attributes: { exclude: ['password'] }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user',
        error: error.message
      });
    }
  }
);

// Create user
router.post('/',
  authenticate,
  authorize('create:users'),
  logAudit('create_user', 'users'),
  async (req, res) => {
    try {
      const {
        username,
        email,
        password,
        fullName,
        department = 'General',
        title = 'Staff',
        clearanceLevel = 1,
        roleIds
      } = req.body;

      // Department restriction for non-superadmins
      if (req.user.maxRoleLevel < 100 && department !== req.user.department) {
        return res.status(403).json({
          success: false,
          message: `ABAC Constraint: Managers can only create users inside their own department (${req.user.department}).`
        });
      }

      // Hierarchy level check on assigned roles
      if (roleIds && roleIds.length > 0) {
        const rolesToAssign = await Role.findAll({ where: { id: roleIds } });
        const maxAssignedRoleLevel = rolesToAssign.reduce((max, r) => Math.max(max, r.level || 0), 0);
        if (req.user.maxRoleLevel < 100 && maxAssignedRoleLevel >= req.user.maxRoleLevel) {
          return res.status(403).json({
            success: false,
            message: 'Hierarchy Violation: Cannot assign a role with level equal to or higher than your own.'
          });
        }
      }

      const existingUser = await User.findOne({
        where: {
          [Op.or]: [{ username }, { email }]
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username or email already exists'
        });
      }

      const user = await User.create({
        username,
        email,
        password,
        fullName,
        department,
        title,
        clearanceLevel: Number(clearanceLevel) || 1
      });

      if (roleIds && roleIds.length > 0) {
        const roles = await Role.findAll({ where: { id: roleIds } });
        await user.addRoles(roles);
      } else {
        // Default to Employee role
        const defaultRole = await Role.findOne({ where: { name: 'Employee' } });
        if (defaultRole) await user.addRole(defaultRole);
      }

      const createdUser = await User.findByPk(user.id, {
        include: [{ model: Role, as: 'roles' }],
        attributes: { exclude: ['password'] }
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: createdUser
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create user',
        error: error.message
      });
    }
  }
);

// Update user (Protected by ABAC hierarchy and department policies)
router.put('/:id',
  authenticate,
  authorize('update:users'),
  enforcePolicy('user', 'update', getUserResourceAttributes),
  logAudit('update_user', 'users'),
  async (req, res) => {
    try {
      const { fullName, email, department, title, clearanceLevel, isActive, roleIds } = req.body;
      const user = await User.findByPk(req.params.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const isSelf = Number(user.id) === Number(req.user.id);

      if (fullName) user.fullName = fullName;
      if (email) user.email = email;

      // Only administrators or managers (not self-service) can alter department, clearance, or active state
      if (!isSelf || req.user.maxRoleLevel >= 100) {
        if (department && (req.user.maxRoleLevel >= 100 || department === req.user.department)) {
          user.department = department;
        }
        if (title) user.title = title;
        if (clearanceLevel !== undefined && req.user.maxRoleLevel >= 100) {
          user.clearanceLevel = Number(clearanceLevel);
        }
        if (typeof isActive !== 'undefined') {
          user.isActive = isActive;
        }
      }

      await user.save();

      // Only allow role assignment if user has permission and is not assigning roles higher than their rank
      if (roleIds && (!isSelf || req.user.maxRoleLevel >= 100)) {
        const targetRoles = await Role.findAll({ where: { id: roleIds } });
        const maxAssigned = targetRoles.reduce((max, r) => Math.max(max, r.level || 0), 0);

        if (req.user.maxRoleLevel < 100 && maxAssigned >= req.user.maxRoleLevel) {
          return res.status(403).json({
            success: false,
            message: 'Hierarchy Violation: Cannot assign a role with level equal to or higher than your own.'
          });
        }
        await user.setRoles(targetRoles);
      }

      const updatedUser = await User.findByPk(user.id, {
        include: [{ model: Role, as: 'roles' }],
        attributes: { exclude: ['password'] }
      });

      res.json({
        success: true,
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update user',
        error: error.message
      });
    }
  }
);

// Delete user (Protected by ABAC hierarchy dominance and department scoping)
router.delete('/:id',
  authenticate,
  authorize('delete:users'),
  enforcePolicy('user', 'delete', getUserResourceAttributes),
  logAudit('delete_user', 'users'),
  async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      await user.destroy();

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete user',
        error: error.message
      });
    }
  }
);

export default router;
