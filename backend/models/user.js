import { DataTypes } from 'sequelize';
import bcrypt from 'bcrypt';
import { sequelize } from '../config/database.js';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50]
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  department: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'General',
    comment: 'Subject attribute for ABAC (e.g., Engineering, HR, Finance)'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Staff',
    comment: 'Job title / designation'
  },
  clearanceLevel: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Subject security clearance (1: Standard, 2: Internal, 3: Confidential)'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// Instance method to compare password
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get user without password
User.prototype.toSafeObject = function() {
  const user = this.toJSON();
  delete user.password;
  if (this.effectivePermissions) {
    user.effectivePermissions = this.effectivePermissions;
  }
  if (this.maxRoleLevel !== undefined) {
    user.maxRoleLevel = this.maxRoleLevel;
  }
  if (this.allRoles) {
    user.allRoles = this.allRoles;
  }
  return user;
};

export default User;