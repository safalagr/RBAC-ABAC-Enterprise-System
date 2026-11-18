import express from 'express';
import { AuditLog, User } from '../models/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { verifyChainIntegrity, computeLogHash, GENESIS_PREVIOUS_HASH } from '../utils/auditChain.js';
import { Op } from 'sequelize';

const router = express.Router();

// Get paginated audit logs
router.get('/', authenticate, authorize('read:audit'), async (req, res) => {
  try {
    const { page = 1, limit = 50, action, status, userId, startDate, endDate } = req.query;
    
    const where = {};
    if (action && typeof action === 'string' && action.trim() !== '') {
      where.action = { [Op.like]: `%${action.trim()}%` };
    }
    if (status && typeof status === 'string' && status.trim() !== '' && status.trim().toLowerCase() !== 'all') {
      where.status = status.trim();
    }
    if (userId) {
      where.userId = Number(userId);
    }
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp[Op.gte] = new Date(startDate);
      if (endDate) where.timestamp[Op.lte] = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;
    
    const { count, rows: logs } = await AuditLog.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'email', 'fullName'],
        required: false // Left outer join to retain system logs where userId is null
      }],
      order: [['id', 'DESC']],
      limit: limitNum,
      offset: offset
    });

    res.json({
      success: true,
      logs: logs || [],
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(count / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs', error: error.message });
  }
});

// Cryptographic Chain Verification Endpoint (SOC2 / ISO 27001 Non-repudiation)
router.get('/verify', authenticate, authorize('read:audit'), async (req, res) => {
  try {
    const result = await verifyChainIntegrity();
    res.json({
      success: true,
      verification: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Chain verification failed', error: error.message });
  }
});

// Audit stats
router.get('/stats', authenticate, authorize('read:audit'), async (req, res) => {
  try {
    const totalLogs = await AuditLog.count();
    const successLogs = await AuditLog.count({ where: { status: 'success' } });
    const failedLogs = await AuditLog.count({ where: { status: 'failed' } });
    const deniedLogs = await AuditLog.count({ where: { status: 'denied' } });

    res.json({
      success: true,
      stats: { totalLogs, successLogs, failedLogs, deniedLogs }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// Demonstration Endpoint: Deliberately tamper with an audit entry to demonstrate fraud detection
router.post('/simulate-tamper', authenticate, authorize('read:audit'), async (req, res) => {
  try {
    // Pick the most recent audit log
    const targetLog = await AuditLog.findOne({ order: [['id', 'DESC']] });
    if (!targetLog) {
      return res.status(400).json({ success: false, message: 'No audit logs found to tamper with.' });
    }

    // Direct database update to simulate unauthorized SQL alteration
    // Intentionally DO NOT update targetLog.hash!
    targetLog.action = 'unauthorized_db_mutation';
    targetLog.status = 'tampered';
    targetLog.details = JSON.stringify({
      alert: 'MALICIOUS MODIFICATION: Record altered directly in database without SHA-256 re-hashing.',
      tamperedAt: new Date().toISOString()
    });
    await targetLog.save();

    res.json({
      success: true,
      message: `Simulated unauthorized database tampering on Audit Log #${targetLog.id}. Running integrity verification will now detect the fraud.`,
      tamperedLogId: targetLog.id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Tamper simulation failed', error: error.message });
  }
});

// Demonstration Endpoint: Recalculate & Repair the cryptographic chain
router.post('/repair-chain', authenticate, authorize('read:audit'), async (req, res) => {
  try {
    const logs = await AuditLog.findAll({ order: [['id', 'ASC']] });
    let previousHash = GENESIS_PREVIOUS_HASH;

    for (const log of logs) {
      // If log was tampered, normalize status and action
      if (log.status === 'tampered' || log.action === 'unauthorized_db_mutation') {
        log.action = 'repaired_operation';
        log.status = 'success';
        log.details = JSON.stringify({ note: 'Record cryptographically repaired and re-anchored into SHA-256 chain.' });
      }

      log.previousHash = previousHash;
      log.hash = computeLogHash({
        previousHash,
        userId: log.userId,
        action: log.action,
        resource: log.resource,
        status: log.status,
        ipAddress: log.ipAddress,
        details: log.details,
        timestamp: log.timestamp
      });
      await log.save();
      previousHash = log.hash;
    }

    res.json({
      success: true,
      message: `Successfully recalculated and repaired cryptographic hash chain across ${logs.length} records.`,
      totalRepaired: logs.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Chain repair failed', error: error.message });
  }
});

export default router;
