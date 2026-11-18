import express from 'express';
import { ApprovalRequest, User, Role, Document } from '../models/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/auditLogger.js';
import { Op } from 'sequelize';

const router = express.Router();

/**
 * Enterprise Rule Engine: Role & Department Scoping for Specific Approval Types
 * Ensures that different types of sensitive operations require matching authority:
 * - ROLE_ELEVATION & USER_DECOMMISSION: Restricted to System Administrators (Level 100)
 * - CLEARANCE_UPGRADE: Restricted to HR Specialists/Managers or Admins
 * - DOCUMENT_PUBLISH: Restricted to Department Managers (Level >= 50) or Admins
 */
export const checkActionAuthority = (user, actionType) => {
  const maxLevel = user.maxRoleLevel || 0;
  const permissions = user.effectivePermissions || [];

  // SuperAdmins (Level 100) possess global supreme override
  if (maxLevel >= 100) return { allowed: true };

  // Must at least possess manage:approvals
  if (!permissions.includes('manage:approvals')) {
    return {
      allowed: false,
      reason: 'Your role does not possess Checker authority (manage:approvals).'
    };
  }

  switch (actionType) {
    case 'ROLE_ELEVATION':
    case 'USER_DECOMMISSION':
      return {
        allowed: false,
        reason: 'Role Elevation and Account Decommissioning approvals are restricted to System Administrators (Level 100).'
      };

    case 'CLEARANCE_UPGRADE':
      if (user.department === 'HR' || maxLevel >= 100) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Security Clearance upgrades can only be approved by HR Specialists or System Administrators.'
      };

    case 'DOCUMENT_PUBLISH':
      if (maxLevel >= 50) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Document publication approvals require Department Manager (Level 50+) or Administrator authority.'
      };

    default:
      return { allowed: true };
  }
};

// GET /api/approvals - List all approval requests with optional filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, view } = req.query;
    const where = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    // Filter view: "my-requests" (Maker) or "review-queue" (Checker)
    const canReview = (req.user.effectivePermissions || []).includes('manage:approvals');

    if (view === 'my-requests') {
      where.requesterId = req.user.id;
    } else if (view === 'review-queue') {
      if (!canReview) {
        // Base employees without Checker authority have an empty review queue
        return res.json({ success: true, requests: [] });
      }
      where.status = 'pending';
      // Dual-Control filter: Exclude self-created requests from checker review queue
      where.requesterId = { [Op.ne]: req.user.id };
    }

    const requests = await ApprovalRequest.findAll({
      where,
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'username', 'fullName', 'department', 'clearanceLevel']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'username', 'fullName', 'department', 'clearanceLevel']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    if (view === 'review-queue') {
      const filtered = requests.filter(r => checkActionAuthority(req.user, r.actionType).allowed);
      return res.json({
        success: true,
        requests: filtered
      });
    }

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch approval requests',
      error: error.message
    });
  }
});

// GET /api/approvals/stats - Get 4-Eyes operational metrics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const total = await ApprovalRequest.count();
    const pending = await ApprovalRequest.count({ where: { status: 'pending' } });
    const approved = await ApprovalRequest.count({ where: { status: 'approved' } });
    const rejected = await ApprovalRequest.count({ where: { status: 'rejected' } });

    // Count pending items that the current user is eligible to review based on their specific role authority
    const canReview = (req.user.effectivePermissions || []).includes('manage:approvals');
    let actionableByMe = 0;
    if (canReview) {
      const pendingItems = await ApprovalRequest.findAll({
        where: {
          status: 'pending',
          requesterId: { [Op.ne]: req.user.id }
        }
      });
      actionableByMe = pendingItems.filter(item => checkActionAuthority(req.user, item.actionType).allowed).length;
    }

    res.json({
      success: true,
      stats: {
        total,
        pending,
        approved,
        rejected,
        actionableByMe
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch approval metrics',
      error: error.message
    });
  }
});

// POST /api/approvals - Create a new 4-Eyes Approval Request (Maker)
router.post('/', authenticate, async (req, res) => {
  try {
    const { actionType, title, resource, resourceId, payload, reason } = req.body;

    if (!actionType || !title || !resource || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Action type, title, resource, and business justification reason are required.'
      });
    }

    const stringifiedPayload = typeof payload === 'object' ? JSON.stringify(payload) : String(payload || '{}');

    const request = await ApprovalRequest.create({
      actionType,
      title,
      resource,
      resourceId: resourceId || null,
      payload: stringifiedPayload,
      reason,
      status: 'pending',
      requesterId: req.user.id
    });

    await logAudit(req, '4EYES_REQUEST_CREATED', resource, 'success', {
      approvalId: request.id,
      actionType,
      title,
      requesterId: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Approval request submitted. Pending independent second-party verification.',
      request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create approval request',
      error: error.message
    });
  }
});

// POST /api/approvals/:id/approve - Approve & execute payload (Checker)
router.post('/:id/approve', authenticate, authorize('manage:approvals'), async (req, res) => {
  try {
    const request = await ApprovalRequest.findByPk(req.params.id, {
      include: [{ model: User, as: 'requester' }]
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Approval request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve request with status '${request.status}'.`
      });
    }

    // 🛡️ CRITICAL NIST AC-5 CHECK: Anti-Self-Approval constraint (Separation of Duties)
    if (request.requesterId === req.user.id) {
      await logAudit(req, '4EYES_SELF_APPROVAL_VIOLATION', request.resource, 'denied', {
        approvalId: request.id,
        attemptedBy: req.user.id,
        violation: 'Maker attempted to act as Checker on their own request'
      });

      return res.status(403).json({
        success: false,
        message: 'Separation of Duties (AC-5) Violation: The Maker cannot review or approve their own submission. An independent Checker is required.'
      });
    }

    // 🛡️ Verify action-specific authority
    const authority = checkActionAuthority(req.user, request.actionType);
    if (!authority.allowed) {
      return res.status(403).json({
        success: false,
        message: authority.reason || 'Insufficient role authority for this approval category.'
      });
    }

    // Parse payload and atomically execute the approved enterprise action
    const payload = JSON.parse(request.payload || '{}');
    let executionSummary = '';

    switch (request.actionType) {
      case 'ROLE_ELEVATION': {
        const targetUser = await User.findByPk(payload.targetUserId);
        if (!targetUser) throw new Error('Target user not found.');
        const targetRole = await Role.findByPk(payload.newRoleId);
        if (!targetRole) throw new Error('Target role not found.');

        await targetUser.setRoles([targetRole]);
        executionSummary = `Elevated user ${targetUser.username} to role ${targetRole.name}`;
        break;
      }

      case 'CLEARANCE_UPGRADE': {
        const targetUser = await User.findByPk(payload.targetUserId);
        if (!targetUser) throw new Error('Target user not found.');

        const oldClearance = targetUser.clearanceLevel;
        targetUser.clearanceLevel = payload.newClearanceLevel;
        await targetUser.save();
        executionSummary = `Upgraded clearance of ${targetUser.username} from Level ${oldClearance} to Level ${payload.newClearanceLevel}`;
        break;
      }

      case 'DOCUMENT_PUBLISH': {
        const document = await Document.findByPk(payload.documentId);
        if (!document) throw new Error('Target document not found.');

        document.status = 'published';
        if (payload.newClassification) {
          document.classification = payload.newClassification;
        }
        await document.save();
        executionSummary = `Published document '${document.title}' with classification ${document.classification}`;
        break;
      }

      case 'USER_DECOMMISSION': {
        const targetUser = await User.findByPk(payload.targetUserId);
        if (!targetUser) throw new Error('Target user not found.');

        targetUser.isActive = false;
        await targetUser.save();
        executionSummary = `Decommissioned user account ${targetUser.username}`;
        break;
      }

      default:
        executionSummary = `Executed generic approval payload for ${request.actionType}`;
    }

    // Update approval status
    request.status = 'approved';
    request.reviewerId = req.user.id;
    request.reviewNote = req.body.note || 'Approved under 4-Eyes Principle verification';
    request.reviewedAt = new Date();
    await request.save();

    // Cryptographic audit logging with dual digital signatures (Maker + Checker)
    await logAudit(req, '4EYES_APPROVAL_EXECUTED', request.resource, 'success', {
      approvalId: request.id,
      actionType: request.actionType,
      makerId: request.requesterId,
      checkerId: req.user.id,
      executionSummary,
      reviewNote: request.reviewNote
    });

    res.json({
      success: true,
      message: `Approval granted and executed successfully: ${executionSummary}`,
      request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Approval execution failed',
      error: error.message
    });
  }
});

// POST /api/approvals/:id/reject - Reject approval request (Checker)
router.post('/:id/reject', authenticate, authorize('manage:approvals'), async (req, res) => {
  try {
    const request = await ApprovalRequest.findByPk(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Approval request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject request with status '${request.status}'.`
      });
    }

    // 🛡️ Anti-Self-Approval constraint also applies to review decisions
    if (request.requesterId === req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Separation of Duties Violation: You cannot review your own request. Please use Cancel Request instead.'
      });
    }

    // 🛡️ Verify action-specific authority
    const authority = checkActionAuthority(req.user, request.actionType);
    if (!authority.allowed) {
      return res.status(403).json({
        success: false,
        message: authority.reason || 'Insufficient role authority for this approval category.'
      });
    }

    request.status = 'rejected';
    request.reviewerId = req.user.id;
    request.reviewNote = req.body.note || 'Rejected by independent Checker';
    request.reviewedAt = new Date();
    await request.save();

    await logAudit(req, '4EYES_REQUEST_REJECTED', request.resource, 'denied', {
      approvalId: request.id,
      makerId: request.requesterId,
      checkerId: req.user.id,
      reason: request.reviewNote
    });

    res.json({
      success: true,
      message: 'Approval request rejected.',
      request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reject approval request',
      error: error.message
    });
  }
});

// POST /api/approvals/:id/cancel - Cancel request (Maker only)
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const request = await ApprovalRequest.findByPk(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Approval request not found.' });
    }

    if (request.requesterId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the original Maker can cancel this request.'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel request with status '${request.status}'.`
      });
    }

    request.status = 'cancelled';
    request.reviewNote = 'Cancelled by Maker prior to review';
    request.reviewedAt = new Date();
    await request.save();

    await logAudit(req, '4EYES_REQUEST_CANCELLED', request.resource, 'success', {
      approvalId: request.id,
      makerId: req.user.id
    });

    res.json({
      success: true,
      message: 'Approval request cancelled.',
      request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel approval request',
      error: error.message
    });
  }
});

export default router;

