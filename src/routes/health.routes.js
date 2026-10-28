/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Health Check Routes
 * ============================================================================
 * 
 * Defines endpoints mounted under /api/health:
 *   GET /api/health    - API liveness check
 *   GET /api/health/db - Database connectivity check
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

// Liveness check
router.get('/', healthController.getHealth);

// Database connectivity check
router.get('/db', healthController.getDbHealth);

module.exports = router;
