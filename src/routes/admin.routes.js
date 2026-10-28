/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Protected Administrator Routes
 * ============================================================================
 * 
 * Defines endpoints mounted under /api/admin:
 *   GET /api/admin/me - Returns authenticated administrator's profile
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateAdmin } = require('../middleware/auth.middleware');

// Protected administrative endpoints (require valid active administrator session)
router.get('/me', authenticateAdmin, adminController.getMe);

module.exports = router;
