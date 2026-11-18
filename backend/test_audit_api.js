import { User, Role, Permission } from './models/index.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const testAuditEndpoints = async () => {
  try {
    const admin = await User.findOne({ where: { username: 'admin' } });
    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET || 'my_key_123',
      { expiresIn: '7d' }
    );

    // Let's test the Express route handlers directly without network!
    const { default: auditRouter } = await import('./routes/audit.js');
    console.log('Audit router loaded successfully');

    // Let's test the database query with exact params that frontend sends
    const { count, rows: logs } = await (await import('./models/index.js')).AuditLog.findAndCountAll({
      where: {},
      include: [{ model: (await import('./models/index.js')).User, as: 'user', attributes: ['id', 'username', 'email', 'fullName'] }],
      order: [['id', 'DESC']],
      limit: 20,
      offset: 0
    });

    console.log('Logs query succeeded! Total logs found:', count);
    logs.forEach(l => {
      console.log(`[#${l.id}] Action: ${l.action}, User: ${l.user?.username || 'System'}, Hash: ${l.hash?.substring(0, 10)}...`);
    });

    const verify = await (await import('./utils/auditChain.js')).verifyChainIntegrity();
    console.log('Verification result:', verify);

    process.exit(0);
  } catch (err) {
    console.error('Audit test failed:', err);
    process.exit(1);
  }
};

testAuditEndpoints();

