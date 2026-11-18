import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Document = sequelize.define('Document', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [2, 120]
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  department: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'General',
    comment: 'Resource department attribute for ABAC evaluation'
  },
  classification: {
    type: DataTypes.ENUM('public', 'internal', 'confidential'),
    defaultValue: 'internal',
    comment: 'Resource classification attribute for ABAC evaluation'
  },
  minClearanceLevel: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Minimum clearance level required to access this resource'
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Resource owner user ID for ownership checks'
  }
});

export default Document;

