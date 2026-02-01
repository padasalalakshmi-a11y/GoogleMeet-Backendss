const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PaymentTransaction = sequelize.define('PaymentTransaction', {
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
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'INR'
  },
  credits: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'success', 'failed', 'refunded'),
    defaultValue: 'pending'
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: true
  },
  paymentGateway: {
    type: DataTypes.STRING,
    defaultValue: 'cashfree'
  },
  gatewayResponse: {
    type: DataTypes.JSON,
    allowNull: true
  },
  failureReason: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'payment_transactions',
  timestamps: true
});

module.exports = PaymentTransaction;
