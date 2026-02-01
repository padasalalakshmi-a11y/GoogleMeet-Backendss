const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
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
    allowNull: true  // Allow null for Google OAuth users
  },
  googleId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  credits: {
    type: DataTypes.INTEGER,
    defaultValue: 30  // Free 30 credits on signup (30 minutes of translation)
  },
  plan: {
    type: DataTypes.ENUM('free', 'starter', 'pro', 'unlimited'),
    defaultValue: 'free'
  },
  lastCreditReset: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  timestamps: true,
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

// Instance methods
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

User.prototype.deductCredits = async function(amount, type = 'usage') {
  const { sequelize } = require('../config/database');
  
  if (this.plan === 'unlimited') {
    return true;  // Unlimited plan doesn't deduct credits
  }
  
  // ✅ FIXED: Use transaction with row locking to prevent race condition
  try {
    await sequelize.transaction(async (t) => {
      // Lock the user row for update
      const user = await User.findByPk(this.id, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.credits < amount) {
        throw new Error('Insufficient credits');
      }
      
      // Deduct credits atomically
      user.credits -= amount;
      await user.save({ transaction: t });
      
      // Update current instance
      this.credits = user.credits;
    });
    
    return true;
  } catch (error) {
    console.error('❌ Credit deduction error:', error.message);
    return false;
  }
};

User.prototype.addCredits = async function(amount) {
  this.credits += amount;
  await this.save();
  return this.credits;
};

User.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password;  // Never send password to client
  return values;
};

module.exports = User;
