/**
 * ABAC Policy Engine (Policy Decision Point - PDP)
 * Implements attribute-based evaluation following NIST SP 800-162.
 * Evaluates: (Subject Attributes, Resource Attributes, Action, Environment)
 */

export const evaluatePolicy = ({ subject, action, resource, environment = {} }) => {
  // If no subject, immediately deny
  if (!subject) {
    return { allowed: false, reason: 'Subject authentication required.' };
  }

  // Superadmin bypass (Role level >= 100 can access almost all resources)
  const isSuperAdmin = subject.maxRoleLevel >= 100 || (subject.roles && subject.roles.some(r => r.name === 'Admin'));

  // 1. EVALUATION FOR "USER" RESOURCE
  if (resource && resource.type === 'user') {
    // A. Self-service rule (Ownership): Any user can read/update their own profile
    if (Number(subject.id) === Number(resource.id)) {
      if (action === 'delete') {
        return { allowed: false, reason: 'Users cannot delete their own active account.' };
      }
      return { allowed: true, reason: 'Self-service ownership allowed.' };
    }

    // B. SuperAdmin can manage other users if subject has strictly higher or equal level
    if (isSuperAdmin) {
      if (resource.targetLevel && resource.targetLevel > subject.maxRoleLevel) {
        return { allowed: false, reason: 'Cannot manage a user with a higher role hierarchy level.' };
      }
      return { allowed: true, reason: 'Superadmin authority granted.' };
    }

    // C. Department boundary check for Managers & Staff with level >= 40
    if (action === 'read') {
      const hasDirectoryPrivilege = (subject.maxRoleLevel || 0) >= 40;
      if (hasDirectoryPrivilege && subject.department && resource.department && subject.department === resource.department) {
        return { allowed: true, reason: 'Same-department directory read access granted.' };
      }
      return { allowed: false, reason: 'Cross-user inspection denied. Non-managerial staff can only view their own profile.' };
    }

    if (action === 'update' || action === 'delete') {
      // Must be same department AND strictly higher role level
      const sameDept = subject.department === resource.department;
      const higherLevel = (subject.maxRoleLevel || 0) > (resource.targetLevel || 0);

      if (!sameDept) {
        return { allowed: false, reason: 'Cannot modify users outside your department.' };
      }
      if (!higherLevel) {
        return { allowed: false, reason: 'Role hierarchy violation: Cannot modify a user with equal or higher rank.' };
      }
      return { allowed: true, reason: 'Department hierarchy authority verified.' };
    }
  }

  // 2. EVALUATION FOR "DOCUMENT" RESOURCE
  if (resource && resource.type === 'document') {
    // SuperAdmin bypass
    if (isSuperAdmin) {
      return { allowed: true, reason: 'Superadmin document access granted.' };
    }

    // A. Read Action
    if (action === 'read') {
      // Public documents accessible to all authenticated users
      if (resource.classification === 'public') {
        return { allowed: true, reason: 'Public document classification.' };
      }

      // Check clearance level first (Security clearance constraint)
      const userClearance = Number(subject.clearanceLevel) || 1;
      const requiredClearance = Number(resource.minClearanceLevel) || 1;
      if (userClearance < requiredClearance) {
        return {
          allowed: false,
          reason: `Insufficient security clearance (Required: Level ${requiredClearance}, Subject: Level ${userClearance}).`
        };
      }

      // Internal classification: Same department or owner or general
      if (resource.classification === 'internal') {
        if (resource.department === 'General' || resource.department === subject.department || resource.ownerId === subject.id) {
          return { allowed: true, reason: 'Department clearance matched for internal document.' };
        }
        return { allowed: false, reason: 'Internal document restricted to department members.' };
      }

      // Confidential classification: Same department + Clearance >= minClearance
      if (resource.classification === 'confidential') {
        const isOwner = Number(resource.ownerId) === Number(subject.id);
        const sameDept = resource.department === subject.department;
        if (isOwner || sameDept) {
          return { allowed: true, reason: 'Confidential access authorized by clearance and department match.' };
        }
        return { allowed: false, reason: 'Confidential document restricted to authorized department personnel.' };
      }
    }

    // B. Create Action
    if (action === 'create') {
      // Users can only create documents in their own department (or 'General')
      if (resource.department && resource.department !== 'General' && resource.department !== subject.department) {
        return { allowed: false, reason: 'Users can only create documents within their assigned department.' };
      }
      return { allowed: true, reason: 'Document creation authorized.' };
    }

    // C. Update / Delete Action
    if (action === 'update' || action === 'delete') {
      // Owner can always update/delete their own document
      if (Number(resource.ownerId) === Number(subject.id)) {
        return { allowed: true, reason: 'Document owner modification allowed.' };
      }

      // Managers with level >= 50 can modify documents in their department with appropriate clearance
      const isManager = subject.maxRoleLevel >= 50;
      const sameDept = resource.department === subject.department;
      const userClearance = Number(subject.clearanceLevel) || 1;
      const requiredClearance = Number(resource.minClearanceLevel) || 1;

      if (isManager && sameDept && userClearance >= requiredClearance) {
        return { allowed: true, reason: 'Department manager management authority granted.' };
      }

      return { allowed: false, reason: 'Only the document owner or department manager can modify this document.' };
    }
  }

  // Fallback default deny
  return { allowed: false, reason: 'No matching ABAC policy permits this action.' };
};
