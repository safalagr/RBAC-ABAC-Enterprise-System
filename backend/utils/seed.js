import { sequelize, User, Role, Permission, Resource, Document, ApprovalRequest } from '../models/index.js';
import { createChainedLog } from './auditChain.js';
import dotenv from 'dotenv';

dotenv.config();

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seed with Hierarchical RBAC & ABAC attributes...');
    
    // Sync database (recreate tables)
    await sequelize.sync({ force: true });
    console.log('✅ Database synced');

    // 1. Create Resources
    const resources = await Resource.bulkCreate([
      { name: 'users', type: 'endpoint', path: '/api/users', description: 'User management' },
      { name: 'roles', type: 'endpoint', path: '/api/roles', description: 'Role management' },
      { name: 'permissions', type: 'endpoint', path: '/api/permissions', description: 'Permission management' },
      { name: 'resources', type: 'endpoint', path: '/api/resources', description: 'Resource management' },
      { name: 'audit', type: 'endpoint', path: '/api/audit', description: 'Audit logs' },
      { name: 'dashboard', type: 'page', path: '/dashboard', description: 'Dashboard page' },
      { name: 'reports', type: 'page', path: '/reports', description: 'Reports page' },
      { name: 'documents', type: 'endpoint', path: '/api/documents', description: 'Enterprise documents (ABAC protected)' },
      { name: 'approvals', type: 'endpoint', path: '/api/approvals', description: '4-Eyes Dual-Control approval workflow' }
    ]);
    console.log('✅ Resources created');

    // 2. Create Permissions
    const permissions = await Permission.bulkCreate([
      // Users permissions (0-3)
      { name: 'create:users', action: 'create', resource: 'users', description: 'Create users', resourceId: resources[0].id },
      { name: 'read:users', action: 'read', resource: 'users', description: 'View users (Scoped via ABAC)', resourceId: resources[0].id },
      { name: 'update:users', action: 'update', resource: 'users', description: 'Update users', resourceId: resources[0].id },
      { name: 'delete:users', action: 'delete', resource: 'users', description: 'Delete users', resourceId: resources[0].id },
      
      // Roles permissions (4-7)
      { name: 'create:roles', action: 'create', resource: 'roles', description: 'Create roles', resourceId: resources[1].id },
      { name: 'read:roles', action: 'read', resource: 'roles', description: 'View roles', resourceId: resources[1].id },
      { name: 'update:roles', action: 'update', resource: 'roles', description: 'Update roles', resourceId: resources[1].id },
      { name: 'delete:roles', action: 'delete', resource: 'roles', description: 'Delete roles', resourceId: resources[1].id },
      
      // Permissions management (8-11)
      { name: 'create:permissions', action: 'create', resource: 'permissions', description: 'Create permissions', resourceId: resources[2].id },
      { name: 'read:permissions', action: 'read', resource: 'permissions', description: 'View permissions', resourceId: resources[2].id },
      { name: 'update:permissions', action: 'update', resource: 'permissions', description: 'Update permissions', resourceId: resources[2].id },
      { name: 'delete:permissions', action: 'delete', resource: 'permissions', description: 'Delete permissions', resourceId: resources[2].id },
      
      // Monitoring & Reports (12-14)
      { name: 'read:audit', action: 'read', resource: 'audit', description: 'View audit logs', resourceId: resources[4].id },
      { name: 'read:dashboard', action: 'read', resource: 'dashboard', description: 'View dashboard', resourceId: resources[5].id },
      { name: 'read:reports', action: 'read', resource: 'reports', description: 'View reports', resourceId: resources[6].id },

      // Enterprise Documents (15-18)
      { name: 'create:documents', action: 'create', resource: 'documents', description: 'Create documents', resourceId: resources[7].id },
      { name: 'read:documents', action: 'read', resource: 'documents', description: 'View documents (ABAC evaluated)', resourceId: resources[7].id },
      { name: 'update:documents', action: 'update', resource: 'documents', description: 'Update documents', resourceId: resources[7].id },
      { name: 'delete:documents', action: 'delete', resource: 'documents', description: 'Delete documents', resourceId: resources[7].id },

      // 4-Eyes Approvals (19-21)
      { name: 'read:approvals', action: 'read', resource: 'approvals', description: 'View approval requests', resourceId: resources[8].id },
      { name: 'create:approvals', action: 'create', resource: 'approvals', description: 'Submit approval requests (Maker)', resourceId: resources[8].id },
      { name: 'manage:approvals', action: 'manage', resource: 'approvals', description: 'Review and decide requests (Checker)', resourceId: resources[8].id }
    ]);
    console.log('✅ Permissions created');

    // 3. Create Roles with Hierarchical Structure (NIST RBAC1)
    // Base Role: Employee
    const employeeRole = await Role.create({ 
      name: 'Employee', 
      description: 'Base enterprise access role', 
      level: 10,
      parentRoleId: null
    });

    // Subordinate Role: HR inherits Employee
    const hrRole = await Role.create({ 
      name: 'HR', 
      description: 'Human Resources role (inherits Employee)', 
      level: 40,
      parentRoleId: employeeRole.id
    });

    // Subordinate Role: Manager inherits Employee
    const managerRole = await Role.create({ 
      name: 'Manager', 
      description: 'Departmental management (inherits Employee)', 
      level: 50,
      parentRoleId: employeeRole.id
    });

    // Top Role: Admin inherits Manager (and transitively Employee)
    const adminRole = await Role.create({ 
      name: 'Admin', 
      description: 'Full system administrator (inherits Manager and Employee)', 
      level: 100,
      parentRoleId: managerRole.id
    });
    
    console.log('✅ Roles created with hierarchy: Admin -> Manager -> Employee');

    // 4. Assign Direct Permissions to Roles (Inheritance resolves the rest!)
    // Employee gets base reading and document creation
    await employeeRole.addPermissions([
      permissions[1],  // read:users
      permissions[13], // read:dashboard
      permissions[15], // create:documents
      permissions[16], // read:documents
      permissions[19], // read:approvals
      permissions[20]  // create:approvals
    ]);

    // Manager gets management permissions (Employee permissions are inherited via hierarchy!)
    await managerRole.addPermissions([
      permissions[2],  // update:users
      permissions[5],  // read:roles
      permissions[12], // read:audit
      permissions[14], // read:reports
      permissions[17], // update:documents
      permissions[18], // delete:documents
      permissions[21]  // manage:approvals
    ]);

    // HR gets user creation/update permissions (inherits Employee permissions!)
    await hrRole.addPermissions([
      permissions[0],  // create:users
      permissions[2]   // update:users
    ]);

    // Admin gets top-tier permissions (inherits Manager and Employee permissions!)
    await adminRole.addPermissions([
      permissions[0],  // create:users
      permissions[3],  // delete:users
      permissions[4],  // create:roles
      permissions[6],  // update:roles
      permissions[7],  // delete:roles
      permissions[8],  // create:permissions
      permissions[9],  // read:permissions
      permissions[10], // update:permissions
      permissions[11], // delete:permissions
      permissions[21]  // manage:approvals
    ]);

    console.log('✅ Permissions assigned to roles (Hierarchy will resolve inherited rights)');

    // 5. Create Users with ABAC Subject Attributes (Department, Title, ClearanceLevel)
    const admin = await User.create({
      username: 'admin',
      email: 'admin@rbac.com',
      password: 'Admin@123',
      fullName: 'System Administrator',
      department: 'IT',
      title: 'Chief Information Security Officer',
      clearanceLevel: 3,
      isActive: true
    });
    await admin.addRole(adminRole);
    
    const manager = await User.create({
      username: 'manager',
      email: 'manager@rbac.com',
      password: 'Manager@123',
      fullName: 'John Manager',
      department: 'Engineering',
      title: 'Engineering Director',
      clearanceLevel: 2,
      isActive: true
    });
    await manager.addRole(managerRole);
    
    const hr = await User.create({
      username: 'hruser',
      email: 'hr@rbac.com',
      password: 'HR@123',
      fullName: 'Sarah HR',
      department: 'HR',
      title: 'Senior HR Specialist',
      clearanceLevel: 2,
      isActive: true
    });
    await hr.addRole(hrRole);
    
    const employee = await User.create({
      username: 'employee',
      email: 'employee@rbac.com',
      password: 'Employee@123',
      fullName: 'Mike Employee',
      department: 'Engineering',
      title: 'Software Engineer',
      clearanceLevel: 1,
      isActive: true
    });
    await employee.addRole(employeeRole);

    const finance = await User.create({
      username: 'finance_user',
      email: 'finance@rbac.com',
      password: 'Finance@123',
      fullName: 'Emma Finance',
      department: 'Finance',
      title: 'Financial Controller',
      clearanceLevel: 2,
      isActive: true
    });
    await finance.addRole(managerRole);
    
    console.log('✅ Enterprise users created with department & clearance attributes');

    // 6. Create Enterprise Documents to demonstrate ABAC evaluation
    const docs = await Document.bulkCreate([
      {
        title: 'Enterprise Code of Conduct & IT Usage Policy',
        content: 'This document defines company-wide ethical guidelines and IT hardware/network usage rules for all employees.',
        department: 'General',
        classification: 'public',
        minClearanceLevel: 1,
        ownerId: admin.id
      },
      {
        title: 'Engineering Q3 Microservices Architecture Plan',
        content: 'Technical specifications for decomposing monolithic billing services into decoupled Kubernetes microservices.',
        department: 'Engineering',
        classification: 'internal',
        minClearanceLevel: 1,
        ownerId: employee.id
      },
      {
        title: 'Confidential AI Core Engine Patent & Intellectual Property',
        content: 'Proprietary mathematical algorithms and neural weights for internal autonomous enterprise agents.',
        department: 'Engineering',
        classification: 'confidential',
        minClearanceLevel: 2,
        ownerId: manager.id
      },
      {
        title: 'Annual Executive Compensation & Audit Review 2026',
        content: 'Sensitive salary benchmarks, performance bonuses, and third-party accounting audit disclosures.',
        department: 'Finance',
        classification: 'confidential',
        minClearanceLevel: 2,
        ownerId: finance.id
      },
      {
        title: 'Project Apex: Secret Merger & Strategic Acquisition Brief',
        content: 'Top-secret board briefing on the planned acquisition of rival cloud analytics platform.',
        department: 'Executive',
        classification: 'confidential',
        minClearanceLevel: 3,
        ownerId: admin.id
      }
    ]);

    console.log('✅ Enterprise Documents created to demonstrate ABAC rules in action');

    // 7. Seed Initial 4-Eyes Dual-Control Approval Requests
    await ApprovalRequest.bulkCreate([
      {
        title: 'Elevate employee to Manager for Tech Lead Duties',
        actionType: 'ROLE_ELEVATION',
        resource: 'users',
        resourceId: employee.id,
        payload: JSON.stringify({
          targetUserId: employee.id,
          targetUsername: employee.username,
          newRoleId: managerRole.id,
          roleName: 'Manager'
        }),
        reason: 'Promoted to Tech Lead for the Core Architecture initiative; requires Manager privileges for approvals.',
        status: 'pending',
        requesterId: manager.id
      },
      {
        title: 'Upgrade employee Clearance to Level 2 for Cloud Security Project',
        actionType: 'CLEARANCE_UPGRADE',
        resource: 'users',
        resourceId: employee.id,
        payload: JSON.stringify({
          targetUserId: employee.id,
          targetUsername: employee.username,
          newClearanceLevel: 2
        }),
        reason: 'Assigned to confidential Cloud Security compliance sprint; requires Level 2 clearance.',
        status: 'pending',
        requesterId: hr.id
      },
      {
        title: 'Publish Restricted Document: Q3 Financial Audit & Ledger Disclosure',
        actionType: 'DOCUMENT_PUBLISH',
        resource: 'documents',
        resourceId: docs[3].id,
        payload: JSON.stringify({
          documentId: docs[3].id,
          newStatus: 'published',
          newClassification: 'restricted'
        }),
        reason: 'Quarterly external ledger disclosure ready for release.',
        status: 'approved',
        requesterId: employee.id,
        reviewerId: admin.id,
        reviewNote: 'Verified compliance with internal audit guidelines and executive clearance.',
        reviewedAt: new Date()
      }
    ]);

    console.log('✅ 4-Eyes Dual-Control Approval Requests seeded (Pending + Approved)');

    // 8. Seed Initial Cryptographically Chained Audit Ledger
    await createChainedLog({
      userId: null,
      action: 'system_genesis',
      resource: 'system',
      status: 'success',
      details: { event: 'Cryptographic Genesis Block created. Tamper-evident ledger initialized.' }
    });

    await createChainedLog({
      userId: admin.id,
      action: 'seed_roles_and_permissions',
      resource: 'roles',
      status: 'success',
      details: { rolesCount: 4, permissionsCount: 19, hierarchyConfigured: true }
    });

    await createChainedLog({
      userId: admin.id,
      action: 'bootstrap_users',
      resource: 'users',
      status: 'success',
      details: { usersBootstrapped: 5, departments: ['IT', 'Engineering', 'HR', 'Finance'] }
    });

    await createChainedLog({
      userId: manager.id,
      action: 'publish_document',
      resource: 'documents',
      status: 'success',
      details: { documentId: 3, classification: 'confidential', clearanceRequired: 2 }
    });

    console.log('✅ Cryptographic Audit Ledger initialized (Genesis + 3 Chained Blocks)');

    console.log('\n🎉 Database seeded successfully!\n');
    console.log('📝 Test Credentials & Attributes:');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('Admin:');
    console.log('  Username: admin | Password: Admin@123 | Dept: IT | Clearance: 3 | Role Level: 100');
    console.log('  Inherits: Manager + Employee permissions');
    console.log('\nManager (Engineering):');
    console.log('  Username: manager | Password: Manager@123 | Dept: Engineering | Clearance: 2 | Role Level: 50');
    console.log('  Inherits: Employee permissions');
    console.log('\nHR:');
    console.log('  Username: hruser | Password: HR@123 | Dept: HR | Clearance: 2 | Role Level: 40');
    console.log('  Inherits: Employee permissions');
    console.log('\nEmployee (Engineering):');
    console.log('  Username: employee | Password: Employee@123 | Dept: Engineering | Clearance: 1 | Role Level: 10');
    console.log('\nFinance Manager:');
    console.log('  Username: finance_user | Password: Finance@123 | Dept: Finance | Clearance: 2 | Role Level: 50');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedDatabase();
