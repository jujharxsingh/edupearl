/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Database Configuration & Connection Pool
 * ============================================================================
 * 
 * This module creates and exports a promise-based MySQL connection pool using
 * `mysql2/promise`.
 * 
 * Viva / Theoretical Concepts for BCA:
 * 1. Connection Pooling: Rather than opening and closing a new TCP/socket 
 *    connection for every incoming query (which is resource-intensive), a pool
 *    maintains a warm set of reusable connections.
 * 2. Promises vs Callbacks: `mysql2/promise` enables standard async/await 
 *    syntax, which makes asynchronous database operations cleaner and easier
 *    to handle with try/catch blocks.
 * 3. 12-Factor App & Environment Isolation: Credentials are never hardcoded.
 *    They are read dynamically from process.env via the dotenv package.
 * ============================================================================
 */

const mysql = require('mysql2/promise');
const path = require('path');

// Ensure environment variables are loaded from the root .env file
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const poolConfig = {
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Support both unified DATABASE_URL and individual DB_* environment variables
if (process.env.DATABASE_URL) {
  poolConfig.uri = process.env.DATABASE_URL;
} else {
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.port = parseInt(process.env.DB_PORT, 10) || 3306;
  poolConfig.user = process.env.DB_USER;
  poolConfig.password = process.env.DB_PASSWORD;
  poolConfig.database = process.env.DB_NAME;
}

// Enable SSL automatically for cloud-hosted databases (or when DB_SSL is true)
const isLocal = !process.env.DB_HOST || process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1';
if (process.env.DB_SSL === 'true' || (!isLocal && process.env.DB_SSL !== 'false' && !process.env.DATABASE_URL?.includes('localhost'))) {
  poolConfig.ssl = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
  };
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
