import { createChainedLog } from '../utils/auditChain.js';

export const logAudit = (action, resource = null) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      res.send = originalSend;
      
      const status = res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failed';
      
      createChainedLog({
        userId: req.user ? req.user.id : null,
        action: action,
        resource: resource || req.baseUrl,
        status: status,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        details: {
          method: req.method,
          path: req.path,
          query: req.query,
          statusCode: res.statusCode
        },
        timestamp: new Date()
      }).catch(err => {
        console.error('Cryptographic audit log error:', err);
      });

      return res.send(data);
    };
    
    next();
  };
};

export const logAccess = async (userId, action, resource, status, details = {}) => {
  try {
    await createChainedLog({
      userId,
      action,
      resource,
      status,
      details,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Audit logging failed:', error);
  }
};
