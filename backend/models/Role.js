import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [2, 50]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Role hierarchy level (higher = more privileges)'
  },
  parentRoleId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Parent role ID for role inheritance hierarchy'
  }
});

export default Role;