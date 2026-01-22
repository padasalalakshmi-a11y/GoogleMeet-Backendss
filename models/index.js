// Models Index - Export all models

const { sequelize } = require('../config/database');
const RoomModel = require('./RoomModel');
const ParticipantModel = require('./ParticipantModel');
const TranslationLogModel = require('./TranslationLogModel');

// Export all models
module.exports = {
  sequelize,
  RoomModel,
  ParticipantModel,
  TranslationLogModel
};
