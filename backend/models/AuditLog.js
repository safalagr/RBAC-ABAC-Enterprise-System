import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Action performed: login, create_user, delete_role, etc.'
  },
  resource: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Resource affected'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'success',
    comment: 'success, failed, denied'
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Additional details in JSON format'
  },
  previousHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    defaultValue: '0000000000000000000000000000000000000000000000000000000000000000',
    comment: 'SHA-256 hash of the preceding log row in the chain'
  },
  hash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    defaultValue: 'GENESIS_HASH',
    comment: 'SHA-256 cryptographic hash of this log row'
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: false
});

export default AuditLog;