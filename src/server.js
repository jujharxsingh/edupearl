/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * HTTP Server Entry Point
 * ============================================================================
 * 
 * Loads environment configuration, binds the Express application to the configured
 * network port, and manages graceful shutdowns.
 * ============================================================================
 */

const path = require('path');
// Ensure environment variables are loaded prior to initializing application components
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');
const pool = require('./config/db');

const PORT = parseInt(process.env.PORT, 10) || 5000;

const server = app.listen(PORT, () => {
  console.log('============================================================');
  console.log('Edu Pearl Immigration Services & Language Point');
  console.log(`Backend Server running on: http://localhost:${PORT}`);
  console.log(`Health Check:             http://localhost:${PORT}/api/health`);
  console.log(`Database Health Check:    http://localhost:${PORT}/api/health/db`);
  console.log(`Admin Login Endpoint:     http://localhost:${PORT}/api/auth/login`);
  console.log(`Admin Profile Endpoint:   http://localhost:${PORT}/api/admin/me`);
  console.log('============================================================');

  // Validate authentication configuration at startup
  const { checkJwtConfiguration } = require('./utils/token');
  const jwtConfig = checkJwtConfiguration();
  if (!jwtConfig.valid) {
    console.error('============================================================');
    console.error('❌ [CONFIGURATION ERROR]: Authentication is disabled.');
    console.error(`   ${jwtConfig.message}`);
    console.error('   Please configure a strong JWT_SECRET (min 32 characters) in .env.');
    console.error('============================================================');
  }
});

// Handle server startup errors (e.g., EADDRINUSE port conflict)
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Startup Error: Port ${PORT} is already in use by another process.`);
    console.error('   Please stop the conflicting process or change the PORT in your .env file.');
  } else {
    console.error('❌ Server Error:', error.message);
  }
  process.exit(1);
});

// Graceful shutdown handling (Ctrl+C / Termination Signals)
const handleShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down HTTP server gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await pool.end();
      console.log('Database connection pool closed cleanly.');
    } catch (err) {
      console.error('Error closing database pool:', err.message);
    }
    process.exit(0);
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
