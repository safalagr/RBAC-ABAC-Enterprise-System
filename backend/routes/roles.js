import express from 'express';
import { Role, Permission, User } from '../models/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/auditLogger.js';

const router = express.Router();

// Helper to detect cycle in role hierarchy
const createsCycle = async (roleId, prospectiveParentId) => {
  if (!prospectiveParentId) return false;
  if (Number(roleId) === Number(prospectiveParentId)) return true;

  let currentId = prospectiveParentId;
  const visited = new Set([roleId]);

  while (currentId) {
    if (visited.has(currentId)) return true;
    visited.add(currentId);

    const parent = await Role.findByPk(currentId, { attributes: ['id', 'parentRoleId'] });
    if (!parent || !parent.parentRoleId) break;
    currentId = parent.parentRoleId;
  }
  return false;
};

// Get all roles (with permissions, parentRole, and childRoles for hierarchy visualization)
router.get('/', authenticate, authorize('read:roles'), async (req, res) => {
  try {
    const roles = await Role.findAll({
      include: [
        { model: Permission, as: 'permissions' },
        { model: Role, as: 'parentRole', attributes: ['id', 'name', 'level'] },
        { model: Role, as: 'childRoles', attributes: ['id', 'name', 'level'] }
      ],
      order: [['level', 'DESC']]
    });
    res.json({ success: true, roles });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch roles', error: error.message });
  }
});

// Get single role
router.get('/:id', authenticate, authorize('read:roles'), async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id, {
      include: [
        { model: Permission, as: 'permissions' },
        { model: Role, as: 'parentRole', attributes: ['id', 'name', 'level'] },
        { model: Role, as: 'childRoles', attributes: ['id', 'name', 'level'] },
        { model: User, as: 'users', attributes: ['id', 'username', 'email', 'fullName', 'department'] }
      ]
    });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    res.json({ success: true, role });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch role' });
  }
});

// Create role
router.post('/', authenticate, authorize('create:roles'), logAudit('create_role', 'roles'), async (req, res) => {
  try {
    const { name, description, level = 0, parentRoleId = null, permissionIds } = req.body;

    // Hierarchy dominance check: cannot create role with higher or equal level than creator's maxRoleLevel (unless Admin >= 100)
    if (req.user.maxRoleLevel < 100 && Number(level) >= req.user.maxRoleLevel) {
      return res.status(403).json({
        success: false,
        message: 'Cannot create a role with level equal to or higher than your own.'
      });
    }

    const role = await Role.create({
      name,
      description,
      level: Number(level),
      parentRoleId: parentRoleId ? Number(parentRoleId) : null
    });
    
    if (permissionIds?.length > 0) {
      const permissions = await Permission.findAll({ where: { id: permissionIds } });
      await role.addPermissions(permissions);
    }
    
    const createdRole = await Role.findByPk(role.id, {
      include: [
        { model: Permission, as: 'permissions' },
        { model: Role, as: 'parentRole', attributes: ['id', 'name', 'level'] }
      ]
    });
    
    res.status(201).json({ success: true, message: 'Role created successfully', role: createdRole });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create role', error: error.message });
  }
});

// Update role
router.put('/:id', authenticate, authorize('update:roles'), logAudit('update_role', 'roles'), async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    // Hierarchy dominance check: cannot edit role with higher or equal level
    if (req.user.maxRoleLevel < 100 && role.level >= req.user.maxRoleLevel) {
      return res.status(403).json({
        success: false,
        message: 'Cannot edit a role with level equal to or higher than your own.'
      });
    }
    
    const { name, description, level, parentRoleId, permissionIds } = req.body;

    // Cycle detection for role inheritance
    if (parentRoleId !== undefined && parentRoleId !== null) {
      const cycleDetected = await createsCycle(role.id, parentRoleId);
      if (cycleDetected) {
        return res.status(400).json({
          success: false,
          message: 'Circular role inheritance detected. A role cannot inherit from itself or its descendants.'
        });
      }
    }

    await role.update({
      name: name ?? role.name,
      description: description ?? role.description,
      level: level !== undefined ? Number(level) : role.level,
      parentRoleId: parentRoleId !== undefined ? (parentRoleId ? Number(parentRoleId) : null) : role.parentRoleId
    });
    
    if (permissionIds) {
      const permissions = await Permission.findAll({ where: { id: permissionIds } });
      await role.setPermissions(permissions);
    }
    
    const updated = await Role.findByPk(role.id, {
      include: [
        { model: Permission, as: 'permissions' },
        { model: Role, as: 'parentRole', attributes: ['id', 'name', 'level'] },
        { model: Role, as: 'childRoles', attributes: ['id', 'name', 'level'] }
      ]
    });
    
    res.json({ success: true, message: 'Role updated successfully', role: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update role', error: error.message });
  }
});

// Delete role
router.delete('/:id', authenticate, authorize('delete:roles'), logAudit('delete_role', 'roles'), async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    // Hierarchy dominance check
    if (req.user.maxRoleLevel < 100 && role.level >= req.user.maxRoleLevel) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete a role with level equal to or higher than your own.'
      });
    }

    await role.destroy();
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete role', error: error.message });
  }
});

export default router;
