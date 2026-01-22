// Room Model - Sequelize Database Model

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RoomModel = sequelize.define('Room', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  roomCode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    validate: {
      is: /^[a-z]{3}-[a-z]{4,5}-[a-z]{3,5}$/ // Format: abc-defg-hij or abc-defgh-ijklm
    }
  },
  createdBy: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'anonymous'
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  participantCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastActivity: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'rooms',
  timestamps: true, // Adds createdAt and updatedAt
  indexes: [
    {
      unique: true,
      fields: ['roomCode']
    },
    {
      fields: ['active']
    },
    {
      fields: ['lastActivity']
    }
  ]
});

// Instance methods
RoomModel.prototype.updateActivity = async function() {
  this.lastActivity = new Date();
  await this.save();
};

RoomModel.prototype.incrementParticipants = async function() {
  this.participantCount += 1;
  await this.save();
};

RoomModel.prototype.decrementParticipants = async function() {
  this.participantCount = Math.max(0, this.participantCount - 1);
  if (this.participantCount === 0) {
    this.active = false;
  }
  await this.save();
};

// Class methods
RoomModel.findByRoomCode = async function(roomCode) {
  return await this.findOne({ where: { roomCode } });
};

RoomModel.findActiveRooms = async function() {
  return await this.findAll({ where: { active: true } });
};

RoomModel.cleanupInactiveRooms = async function(hoursInactive = 24) {
  const cutoffTime = new Date(Date.now() - hoursInactive * 60 * 60 * 1000);
  
  const result = await this.update(
    { active: false },
    {
      where: {
        lastActivity: { [sequelize.Sequelize.Op.lt]: cutoffTime },
        active: true
      }
    }
  );
  
  return result[0]; // Number of rows updated
};

module.exports = RoomModel;
