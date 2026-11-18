import { sequelize } from '../config/database.js';
import User from './user.js';
import Role from './Role.js';
import Permission from './Permission.js';
import Resource from './Resource.js';
import AuditLog from './AuditLog.js';
import Document from './Document.js';
import ApprovalRequest from './ApprovalRequest.js';

// Define relationships

// Role Hierarchy (Self-referencing parent-child for RBAC1)
Role.belongsTo(Role, { foreignKey: 'parentRoleId', as: 'parentRole' });
Role.hasMany(Role, { foreignKey: 'parentRoleId', as: 'childRoles' });

// User - Role (Many-to-Many)
User.belongsToMany(Role, { through: 'UserRoles', as: 'roles' });
Role.belongsToMany(User, { through: 'UserRoles', as: 'users' });

// Role - Permission (Many-to-Many)
Role.belongsToMany(Permission, { through: 'RolePermissions', as: 'permissions' });
Permission.belongsToMany(Role, { through: 'RolePermissions', as: 'roles' });

// Permission - Resource (Many-to-One)
Permission.belongsTo(Resource, { foreignKey: 'resourceId', as: 'resourceDetail' });
Resource.hasMany(Permission, { foreignKey: 'resourceId', as: 'permissions' });

// AuditLog - User (Many-to-One)
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });

// Document - User (Many-to-One ownership)
Document.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
User.hasMany(Document, { foreignKey: 'ownerId', as: 'documents' });

// Dual-Control Maker-Checker Approval Requests
ApprovalRequest.belongsTo(User, { foreignKey: 'requesterId', as: 'requester' });
ApprovalRequest.belongsTo(User, { foreignKey: 'reviewerId', as: 'reviewer' });
User.hasMany(ApprovalRequest, { foreignKey: 'requesterId', as: 'initiatedApprovals' });
User.hasMany(ApprovalRequest, { foreignKey: 'reviewerId', as: 'reviewedApprovals' });

export {
  sequelize,
  User,
  Role,
  Permission,
  Resource,
  AuditLog,
  Document,
  ApprovalRequest
};