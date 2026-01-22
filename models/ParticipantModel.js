// Participant Model - Sequelize Database Model

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const RoomModel = require('./RoomModel');

const ParticipantModel = sequelize.define('Participant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  socketId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  userName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  language: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: 'Language user wants to receive translations in'
  },
  speakingLanguage: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: 'Language user is speaking'
  },
  roomId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'rooms',
      key: 'id'
    }
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  joinedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  leftAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'participants',
  timestamps: true,
  indexes: [
    {
      fields: ['socketId']
    },
    {
      fields: ['roomId']
    },
    {
      fields: ['active']
    }
  ]
});

// Define associations
RoomModel.hasMany(ParticipantModel, {
  foreignKey: 'roomId',
  as: 'participants'
});

ParticipantModel.belongsTo(RoomModel, {
  foreignKey: 'roomId',
  as: 'room'
});

// Instance methods
ParticipantModel.prototype.leave = async function() {
  this.active = false;
  this.leftAt = new Date();
  await this.save();
};

// Class methods
ParticipantModel.findBySocketId = async function(socketId) {
  return await this.findOne({
    where: { socketId, active: true },
    include: [{
      model: RoomModel,
      as: 'room'
    }]
  });
};

ParticipantModel.findByRoomId = async function(roomId) {
  return await this.findAll({
    where: { roomId, active: true }
  });
};

ParticipantModel.countByRoomId = async function(roomId) {
  return await this.count({
    where: { roomId, active: true }
  });
};

module.exports = ParticipantModel;
