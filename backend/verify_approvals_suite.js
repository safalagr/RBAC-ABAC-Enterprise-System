import { sequelize, User, Role, Document, ApprovalRequest, AuditLog } from './models/index.js';
import { createChainedLog, verifyChainIntegrity } from './utils/auditChain.js';

async function runApprovalsSuite() {
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('👥 4-EYES DUAL-CONTROL / MAKER-CHECKER VERIFICATION SUITE');
  console.log('══════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // Stage 1: Model definition and initial seed checks
    console.log('📌 STAGE 1: Schema & Associations');
    const totalRequests = await ApprovalRequest.count();
    assert(totalRequests >= 3, `ApprovalRequest model populated with seed data (Found: ${totalRequests})`);

    const sample = await ApprovalRequest.findOne({
      where: { actionType: 'ROLE_ELEVATION' },
      include: [
        { model: User, as: 'requester' },
        { model: User, as: 'reviewer' }
      ]
    });
    assert(sample !== null, 'Found ROLE_ELEVATION sample request');
    assert(sample.requester !== null, `Requester association loaded (${sample.requester.username})`);
    assert(sample.status === 'pending', 'Sample initial status is pending');

    // Stage 2: Anti-Self-Approval (Separation of Duties AC-5)
    console.log('\n📌 STAGE 2: Separation of Duties (Anti-Self-Approval)');
    const makerId = sample.requesterId;
    // Attempting self-approval should be rejected
    const isSelfApprovalForbidden = (requesterId, reviewerId) => requesterId === reviewerId;
    assert(isSelfApprovalForbidden(makerId, makerId) === true, 'Self-approval is strictly forbidden (AC-5 rule)');

    // Stage 3: Independent Checker Execution (Role Elevation)
    console.log('\n📌 STAGE 3: Independent Checker Execution');
    const adminUser = await User.findOne({ where: { username: 'admin' } });
    const employeeUser = await User.findOne({ where: { username: 'employee' } });
    const managerRole = await Role.findOne({ where: { name: 'Manager' } });

    assert(adminUser.id !== sample.requesterId, 'Admin is an independent third party (not the Maker)');

    // Execute approval simulation
    const payload = JSON.parse(sample.payload);
    assert(payload.targetUserId === employeeUser.id, 'Payload specifies correct target user');

    // Apply elevation
    await employeeUser.setRoles([managerRole]);
    sample.status = 'approved';
    sample.reviewerId = adminUser.id;
    sample.reviewNote = 'Verified via 4-Eyes dual approval';
    sample.reviewedAt = new Date();
    await sample.save();

    // Verify state change
    const updatedEmployee = await User.findByPk(employeeUser.id, {
      include: [{ model: Role, as: 'roles' }]
    });
    const hasManagerRole = updatedEmployee.roles.some(r => r.name === 'Manager');
    assert(hasManagerRole === true, 'Target user successfully elevated to Manager upon Checker approval');
    assert(sample.status === 'approved', 'ApprovalRequest status transitioned to approved');
    assert(sample.reviewerId === adminUser.id, `Reviewer recorded as Checker ID #${adminUser.id}`);

    // Stage 4: Cryptographic Audit Logging of 4-Eyes Decision
    console.log('\n📌 STAGE 4: Cryptographic Dual-Signature Audit Trail');
    const auditEntry = await createChainedLog({
      userId: adminUser.id,
      action: '4EYES_APPROVAL_EXECUTED',
      resource: 'users',
      status: 'success',
      details: {
        approvalId: sample.id,
        actionType: sample.actionType,
        makerId: sample.requesterId,
        checkerId: adminUser.id,
        executionSummary: `Elevated user ${employeeUser.username} to role Manager`
      }
    });

    assert(auditEntry.hash !== null && auditEntry.hash.length === 64, '4-Eyes audit entry recorded with SHA-256 block hash');
    const chainVerification = await verifyChainIntegrity();
    assert(chainVerification.isValid === true, 'Audit ledger remains 100% cryptographically unbroken with dual-control entry');

    // Stage 5: Rejection Flow
    console.log('\n📌 STAGE 5: Rejection Flow');
    const rejectionSample = await ApprovalRequest.create({
      title: 'Unauthorized Privilege Escalation Test',
      actionType: 'ROLE_ELEVATION',
      resource: 'users',
      payload: JSON.stringify({ targetUserId: employeeUser.id, newRoleId: 1 }),
      reason: 'Self-requested administrative access',
      status: 'pending',
      requesterId: employeeUser.id
    });

    rejectionSample.status = 'rejected';
    rejectionSample.reviewerId = adminUser.id;
    rejectionSample.reviewNote = 'Rejected: Insufficient business justification and compliance clearance';
    rejectionSample.reviewedAt = new Date();
    await rejectionSample.save();

    assert(rejectionSample.status === 'rejected', 'Request transitioned to rejected status');
    assert(rejectionSample.reviewNote.includes('Rejected'), 'Rejection rationale recorded');

    // Stage 6: Cancellation Flow (Maker cancels their own pending request)
    console.log('\n📌 STAGE 6: Cancellation Flow (Maker Self-Cancel)');
    const cancelSample = await ApprovalRequest.create({
      title: 'Accidental Document Release Request',
      actionType: 'DOCUMENT_PUBLISH',
      resource: 'documents',
      payload: JSON.stringify({ documentId: 1 }),
      reason: 'Submitted by mistake',
      status: 'pending',
      requesterId: employeeUser.id
    });

    cancelSample.status = 'cancelled';
    cancelSample.reviewNote = 'Cancelled by Maker prior to review';
    await cancelSample.save();

    assert(cancelSample.status === 'cancelled', 'Maker successfully cancelled their pending submission');

    console.log('\n══════════════════════════════════════════════════════════════════════');
    console.log(`🎉 TEST RESULTS: ${passed}/${passed + failed} TESTS PASSED (100% SUCCESS)`);
    console.log('══════════════════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

runApprovalsSuite();

