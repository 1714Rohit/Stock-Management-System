const mysql = require('mysql2/promise');
require('dotenv').config();

let poolConfig;

if (process.env.DATABASE_URL) {
  // Use connection string (URI) if provided (common in cloud databases)
  poolConfig = {
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
} else {
  // Otherwise, use individual parameters
  poolConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'multi_tenant_stock_mgmt',
    port: parseInt(process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
}

// Enable SSL if specified in env (required by TiDB, Aiven, etc.)
if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = mysql.createPool(poolConfig);

// Test connection
pool.getConnection()
  .then(conn => {
    console.log('Connected to MySQL Database successfully!');
    conn.release();
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
  });

module.exports = pool;
