// Models Index - Export all models

const { sequelize } = require('../config/database');
const RoomModel = require('./RoomModel');
const ParticipantModel = require('./ParticipantModel');
const TranslationLogModel = require('./TranslationLogModel');
const UserModel = require('./UserModel');
const CreditUsageLog = require('./CreditUsageLog');
const PaymentTransaction = require('./PaymentTransaction');

// Export all models
module.exports = {
  sequelize,
  RoomModel,
  ParticipantModel,
  TranslationLogModel,
  UserModel,
  CreditUsageLog,
  PaymentTransaction
};
