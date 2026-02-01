// Database Configuration with Sequelize

const { Sequelize } = require('sequelize');
require('dotenv').config();

// Create Sequelize instance
const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false // For Supabase
    }
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  // Alternative: Log only errors in production
  // logging: process.env.NODE_ENV === 'development' ? console.log : (msg) => {
  //   if (msg.includes('ERROR')) console.error(msg);
  // },
  pool: {
    max: 20,        // ✅ FIXED: Increased from 5 to 20 for better concurrency
    min: 2,         // Keep minimum connections alive
    acquire: 60000, // Longer timeout for acquiring connection
    idle: 10000
  }
});

// Test database connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to database:', error.message);
    return false;
  }
}

// Sync database (create tables)
async function syncDatabase() {
  try {
    await sequelize.sync({ alter: true }); // Use alter in development, force: false in production
    console.log('✅ Database synchronized successfully');
  } catch (error) {
    console.error('❌ Database sync error:', error.message);
  }
}

module.exports = {
  sequelize,
  testConnection,
  syncDatabase
};
