/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Health Check Controller
 * ============================================================================
 * 
 * Provides diagnostic endpoint handlers to verify API liveness and database
 * connectivity.
 * 
 * Security Guarantee:
 * - Never returns connection strings, credentials, or internal query details.
 * - Errors are caught and masked with generic safe messages.
 * ============================================================================
 */

const pool = require('../config/db');

/**
 * Basic API liveness check
 * Route: GET /api/health
 */
const getHealth = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Edu Pearl Immigration Services & Language Point API',
    timestamp: new Date().toISOString()
  });
};

/**
 * Database connectivity health check
 * Route: GET /api/health/db
 */
const getDbHealth = async (req, res, next) => {
  try {
    // Execute a minimal ping query using the connection pool
    await pool.query('SELECT 1 AS status');

    res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Log detailed error internally on the server console for debugging
    console.error('[Health Check Error] Database ping failed:', error.message);

    // Return a safe 503 Service Unavailable response without leaking internal details
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: 'Unable to connect to the database service.'
    });
  }
};

module.exports = {
  getHealth,
  getDbHealth
};
