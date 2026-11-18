import crypto from 'crypto';
import { AuditLog } from '../models/index.js';

export const GENESIS_PREVIOUS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes deterministic SHA-256 hash for an audit log entry.
 */
export const computeLogHash = ({
  previousHash,
  userId,
  action,
  resource,
  status,
  ipAddress,
  details,
  timestamp
}) => {
  // Normalize timestamp to ISO string to ensure consistent hashing
  const timeStr = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();
  const rawPayload = [
    previousHash || GENESIS_PREVIOUS_HASH,
    userId ?? 'null',
    action || '',
    resource || '',
    status || '',
    ipAddress || '',
    details || '',
    timeStr
  ].join('|');

  return crypto.createHash('sha256').update(rawPayload).digest('hex');
};

/**
 * Creates an append-only, hash-chained audit log entry.
 */
export const createChainedLog = async ({
  userId = null,
  action,
  resource = null,
  status = 'success',
  ipAddress = null,
  userAgent = null,
  details = null,
  timestamp = new Date()
}) => {
  try {
    // Find the latest audit log entry to establish the cryptographic chain link
    const lastLog = await AuditLog.findOne({
      order: [['id', 'DESC']]
    });

    const previousHash = lastLog && lastLog.hash ? lastLog.hash : GENESIS_PREVIOUS_HASH;

    const detailsStr = typeof details === 'object' && details !== null ? JSON.stringify(details) : (details || '');

    const hash = computeLogHash({
      previousHash,
      userId,
      action,
      resource,
      status,
      ipAddress,
      details: detailsStr,
      timestamp
    });

    return await AuditLog.create({
      userId,
      action,
      resource,
      status,
      ipAddress,
      userAgent,
      details: detailsStr,
      previousHash,
      hash,
      timestamp
    });
  } catch (err) {
    console.error('Cryptographic Audit Log failure:', err);
    throw err;
  }
};

/**
 * Verifies the entire cryptographic hash chain across the database.
 * Returns { isValid: boolean, totalLogs: number, tamperedRow: object|null, reason: string|null }
 */
export const verifyChainIntegrity = async () => {
  const allLogs = await AuditLog.findAll({
    order: [['id', 'ASC']]
  });

  if (allLogs.length === 0) {
    return {
      isValid: true,
      totalLogs: 0,
      message: 'Audit log is empty (Genesis state).'
    };
  }

  let expectedPreviousHash = GENESIS_PREVIOUS_HASH;

  for (let i = 0; i < allLogs.length; i++) {
    const log = allLogs[i];

    // Check link integrity (Does previousHash match the preceding row's hash?)
    if (log.previousHash !== expectedPreviousHash) {
      return {
        isValid: false,
        tamperedRowId: log.id,
        tamperedLog: log,
        reason: `Cryptographic Chain Broken at Log #${log.id}. Stored previousHash does not match previous entry's hash.`,
        expectedPreviousHash,
        actualPreviousHash: log.previousHash
      };
    }

    // Check content integrity (Has any field in this row been modified?)
    const recomputedHash = computeLogHash({
      previousHash: log.previousHash,
      userId: log.userId,
      action: log.action,
      resource: log.resource,
      status: log.status,
      ipAddress: log.ipAddress,
      details: log.details,
      timestamp: log.timestamp
    });

    if (recomputedHash !== log.hash) {
      return {
        isValid: false,
        tamperedRowId: log.id,
        tamperedLog: log,
        reason: `Cryptographic Tampering Detected at Log #${log.id}. Content modified! Computed SHA-256 does not match recorded block hash.`,
        recordedHash: log.hash,
        recomputedHash
      };
    }

    expectedPreviousHash = log.hash;
  }

  return {
    isValid: true,
    totalLogs: allLogs.length,
    genesisHash: allLogs[0].hash,
    latestBlockHash: allLogs[allLogs.length - 1].hash,
    verifiedAt: new Date().toISOString()
  };
};

