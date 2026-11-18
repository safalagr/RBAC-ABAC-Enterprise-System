import { Role, Permission } from '../models/index.js';

/**
 * Recursively resolves all inherited roles and permissions for a given list of roles (NIST RBAC1).
 * Traverses parent/ancestor roles so higher-level roles inherit lower-level capabilities automatically.
 *
 * @param {Array<object>} userRoles - Array of Role instances with permissions and parentRoleId
 * @returns {Promise<{ allRoles: Array<object>, effectivePermissions: Array<string>, maxRoleLevel: number }>}
 */
export const resolveRoleHierarchy = async (userRoles = []) => {
  const visitedRoleIds = new Set();
  const effectiveRoles = [];
  const permissionKeys = new Set();
  let maxRoleLevel = 0;

  // Queue of roles to process
  const roleQueue = [...userRoles];

  while (roleQueue.length > 0) {
    const currentRole = roleQueue.shift();
    if (!currentRole || visitedRoleIds.has(currentRole.id)) {
      continue;
    }

    visitedRoleIds.add(currentRole.id);
    effectiveRoles.push(currentRole);

    if (typeof currentRole.level === 'number' && currentRole.level > maxRoleLevel) {
      maxRoleLevel = currentRole.level;
    }

    // Add direct permissions of currentRole
    if (Array.isArray(currentRole.permissions)) {
      currentRole.permissions.forEach((perm) => {
        permissionKeys.add(`${perm.action}:${perm.resource}`);
      });
    }

    // If role has a parentRoleId, fetch parent role with its permissions if not already visited
    if (currentRole.parentRoleId && !visitedRoleIds.has(currentRole.parentRoleId)) {
      const parentRole = await Role.findByPk(currentRole.parentRoleId, {
        include: [{
          model: Permission,
          as: 'permissions'
        }]
      });

      if (parentRole) {
        roleQueue.push(parentRole);
      }
    }
  }

  return {
    allRoles: effectiveRoles,
    effectivePermissions: Array.from(permissionKeys),
    maxRoleLevel
  };
};

/**
 * Checks if a subject role has higher hierarchy level than a target role level.
 */
export const hasHigherLevel = (subjectLevel, targetLevel) => {
  return Number(subjectLevel) > Number(targetLevel);
};

