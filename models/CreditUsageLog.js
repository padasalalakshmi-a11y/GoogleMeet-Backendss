const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CreditUsageLog = sequelize.define('CreditUsageLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  roomId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'rooms',
      key: 'id'
    }
  },
  roomCode: {
    type: DataTypes.STRING,
    allowNull: false
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  creditsUsed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  translationActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'credit_usage_logs',
  timestamps: true
});

// Instance methods
CreditUsageLog.prototype.calculateCredits = function() {
  if (!this.endTime) {
    // Still active, calculate from start to now
    const minutes = Math.ceil((Date.now() - this.startTime.getTime()) / 60000);
    return minutes;
  }
  
  // Calculate from start to end
  const minutes = Math.ceil((this.endTime.getTime() - this.startTime.getTime()) / 60000);
  return minutes;
};

CreditUsageLog.prototype.endSession = async function() {
  this.endTime = new Date();
  this.translationActive = false;
  // Don't recalculate - use the actual creditsUsed that was tracked during the session
  // this.creditsUsed = this.calculateCredits(); // ❌ REMOVED - causes mismatch
  await this.save();
  return this.creditsUsed;
};

module.exports = CreditUsageLog;
