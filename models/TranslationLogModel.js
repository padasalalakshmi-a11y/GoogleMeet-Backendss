// Translation Log Model - Track all translations (optional, for analytics)

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const RoomModel = require('./RoomModel');

const TranslationLogModel = sequelize.define('TranslationLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  roomId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'rooms',
      key: 'id'
    }
  },
  originalText: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  translatedText: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  sourceLanguage: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  targetLanguage: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  fromSocketId: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  toSocketId: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  translationTime: {
    type: DataTypes.INTEGER,
    comment: 'Translation time in milliseconds'
  }
}, {
  tableName: 'translation_logs',
  timestamps: true,
  indexes: [
    {
      fields: ['roomId']
    },
    {
      fields: ['sourceLanguage', 'targetLanguage']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Define association
RoomModel.hasMany(TranslationLogModel, {
  foreignKey: 'roomId',
  as: 'translations'
});

TranslationLogModel.belongsTo(RoomModel, {
  foreignKey: 'roomId',
  as: 'room'
});

// Class methods
TranslationLogModel.getStatsByRoom = async function(roomId) {
  const stats = await this.findAll({
    where: { roomId },
    attributes: [
      'sourceLanguage',
      'targetLanguage',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('AVG', sequelize.col('translationTime')), 'avgTime']
    ],
    group: ['sourceLanguage', 'targetLanguage']
  });
  
  return stats;
};

module.exports = TranslationLogModel;
