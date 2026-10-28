/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Database Connectivity Verification Script
 * ============================================================================
 * 
 * Usage:
 *   node database/test-connection.js
 *   OR
 *   npm run test:db
 * 
 * Security Guard:
 *   This script explicitly DOES NOT log or print passwords or secrets.
 *   It only outputs safe connection telemetry (host, port, user, db, version).
 * ============================================================================
 */

const path = require('path');
// Load environment variables before importing db configuration
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = require('../src/config/db');

async function testConnection() {
  console.log('------------------------------------------------------------');
  console.log('Edu Pearl Immigration Services & Language Point');
  console.log('Testing MySQL Database Connectivity...');
  console.log('------------------------------------------------------------');

  // Verify that required environment variables are provided
  const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_NAME'];
  const missingEnv = requiredEnv.filter((varName) => !process.env[varName]);

  if (missingEnv.length > 0) {
    console.error('❌ Configuration Error: Missing required environment variables:');
    missingEnv.forEach((v) => console.error(`   - ${v}`));
    console.error('\nPlease ensure you have copied .env.example to .env and filled in your database credentials:');
    console.error('   copy .env.example .env\n');
    process.exit(1);
  }

  // Safe configuration info (PASSWORD IS INTENTIONALLY OMITTED)
  console.log('Connection Parameters:');
  console.log(` • Host:     ${process.env.DB_HOST}`);
  console.log(` • Port:     ${process.env.DB_PORT || 3306}`);
  console.log(` • User:     ${process.env.DB_USER}`);
  console.log(` • Database: ${process.env.DB_NAME}`);
  console.log(' • Password: [CONFIGURED - HIDDEN FOR SECURITY]');
  console.log('------------------------------------------------------------');

  let connection;
  try {
    // Attempt to acquire a connection from the pool
    connection = await pool.getConnection();

    // Execute diagnostic queries
    const [testResult] = await connection.query(
      'SELECT 1 + 1 AS calculation, DATABASE() AS current_db, VERSION() AS mysql_version, USER() AS authenticated_user'
    );

    const [tables] = await connection.query('SHOW TABLES');

    console.log('✅ Connection Successful!');
    console.log(` • Active DB:       ${testResult[0].current_db || '(None selected)'}`);
    console.log(` • MySQL Version:   ${testResult[0].mysql_version}`);
    console.log(` • Auth User:       ${testResult[0].authenticated_user}`);
    console.log(` • Test Query:      1 + 1 = ${testResult[0].calculation}`);
    console.log(` • Tables Found:    ${tables.length} table(s) present in ${process.env.DB_NAME}`);

    if (tables.length > 0) {
      console.log(' • Table list:');
      tables.forEach((t) => {
        const tableName = Object.values(t)[0];
        console.log(`    - ${tableName}`);
      });
    } else {
      console.log('   (Database is currently clean and ready for schema migrations in Milestone 2)');
    }

    console.log('------------------------------------------------------------');
    console.log('Milestone 1 Database Connectivity Verification PASSED.');
    console.log('------------------------------------------------------------');
  } catch (error) {
    console.error('❌ Connection Failed:');
    console.error(` • Error Code:    ${error.code || 'UNKNOWN'}`);
    console.error(` • Error Number:  ${error.errno || 'N/A'}`);
    console.error(` • Message:       ${error.message}`);
    console.log('------------------------------------------------------------');
    console.log('Troubleshooting Guide for Windows & MySQL:');

    if (error.code === 'ECONNREFUSED') {
      console.log(' 1. The MySQL service does not appear to be running.');
      console.log('    -> Press Win + R, type "services.msc", and start the "MySQL" or "MySQL80" service.');
      console.log('    -> Or verify the port (default is 3306, some XAMPP setups use 3307).');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log(' 2. Access denied for user.');
      console.log('    -> Check DB_USER and DB_PASSWORD in your .env file.');
      console.log('    -> Verify the application user has been created in MySQL and granted permissions.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log(` 3. Database "${process.env.DB_NAME}" does not exist.`);
      console.log(`    -> Log into MySQL and run: CREATE DATABASE ${process.env.DB_NAME};`);
    } else {
      console.log(' 4. Check network connectivity and database host settings.');
    }
    console.log('------------------------------------------------------------');
    process.exitCode = 1;
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

testConnection();
