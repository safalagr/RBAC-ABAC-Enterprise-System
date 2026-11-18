import jwt from 'jsonwebtoken';
import { User, Role, Permission } from '../models/index.js';
import { resolveRoleHierarchy } from '../utils/hierarchyResolver.js';
import { evaluatePolicy } from '../utils/abacEngine.js';

/**
 * Authentication Middleware
 * Validates JWT token, loads user with roles/permissions, and resolves RBAC1 role hierarchy.
 */
export const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      include: [{
        model: Role,
        as: 'roles',
        include: [{
          model: Permission,
          as: 'permissions'
        }]
      }]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Contact administrator.'
      });
    }

    // Resolve Role Hierarchy (NIST RBAC1)
    const { allRoles, effectivePermissions, maxRoleLevel } = await resolveRoleHierarchy(user.roles || []);

    user.allRoles = allRoles;
    user.effectivePermissions = effectivePermissions;
    user.maxRoleLevel = maxRoleLevel;

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Authentication error.'
    });
  }
};

/**
 * Authorization Middleware (Hierarchical RBAC)
 * Validates that the subject possesses required permissions (direct or inherited).
 */
export const authorize = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.'
        });
      }

      const userPermissions = req.user.effectivePermissions || [];

      // Check if user has all required permissions
      const hasPermission = requiredPermissions.every(perm => 
        userPermissions.includes(perm)
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions (Evaluated via Role Hierarchy).',
          required: requiredPermissions,
          available: userPermissions
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Authorization error.'
      });
    }
  };
};

/**
 * Role Check Middleware
 * Verifies role presence across direct and inherited roles.
 */
export const requireRole = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.'
        });
      }

      const userRoleNames = (req.user.allRoles || req.user.roles || []).map(role => role.name);
      const hasRole = roles.some(role => userRoleNames.includes(role));

      if (!hasRole) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient role privileges.',
          required: roles,
          available: userRoleNames
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Role check error.'
      });
    }
  };
};

/**
 * ABAC Policy Enforcement Middleware (NIST SP 800-162 PEP)
 * Evaluates fine-grained contextual attributes (Department, Clearance, Ownership, Hierarchy).
 *
 * @param {string} resourceType - e.g., 'user', 'document'
 * @param {string} action - 'read', 'create', 'update', 'delete'
 * @param {Function} [resourceExtractor] - Async function (req) => resourceAttributes object
 */
export const enforcePolicy = (resourceType, action, resourceExtractor) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.'
        });
      }

      let resourceAttrs = { type: resourceType };
      if (typeof resourceExtractor === 'function') {
        const extracted = await resourceExtractor(req);
        if (!extracted) {
          return res.status(404).json({
            success: false,
            message: `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} not found.`
          });
        }
        resourceAttrs = { ...resourceAttrs, ...extracted };
      }

      const decision = evaluatePolicy({
        subject: {
          id: req.user.id,
          username: req.user.username,
          department: req.user.department,
          clearanceLevel: req.user.clearanceLevel,
          maxRoleLevel: req.user.maxRoleLevel,
          roles: req.user.allRoles || req.user.roles,
          permissions: req.user.effectivePermissions
        },
        action,
        resource: resourceAttrs,
        environment: {
          currentTime: new Date(),
          ip: req.ip
        }
      });

      if (!decision.allowed) {
        return res.status(403).json({
          success: false,
          message: `Access Denied (ABAC Policy): ${decision.reason}`,
          policyDecision: decision
        });
      }

      req.policyDecision = decision;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Policy evaluation error: ${error.message}`
      });
    }
  };
};
