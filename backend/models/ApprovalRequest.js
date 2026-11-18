import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ApprovalRequest = sequelize.define('ApprovalRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  actionType: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Action type: ROLE_ELEVATION, DOCUMENT_PUBLISH, CLEARANCE_UPGRADE, USER_DECOMMISSION'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  resource: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Target resource: users, documents, roles'
  },
  resourceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Target entity ID'
  },
  payload: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'JSON payload describing target state change'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Maker business justification'
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'approved', 'rejected', 'cancelled']]
    }
  },
  requesterId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  reviewerId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  reviewNote: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true
});

export default ApprovalRequest;

