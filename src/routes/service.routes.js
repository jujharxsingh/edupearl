/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Services & Courses Routes (Milestone 5, Phase 3)
 * ============================================================================
 * 
 * Defines endpoints mounted under /api/services:
 *   GET   /api/services            - Public list of active services/courses (with category/featured filters)
 *   GET   /api/services/slug/:slug - Public single service/course by unique URL slug
 *   GET   /api/services/:id        - Public single service/course by numeric ID
 *   POST  /api/services            - Create service/course (super_admin, branch_admin)
 *   PUT   /api/services/:id        - Update service/course (super_admin, branch_admin)
 *   PATCH /api/services/:id/status - Toggle/set active status (super_admin only, soft-delete)
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service.controller');
const {
  authenticateAdmin,
  authorizeRoles,
  optionalAuthenticateAdmin
} = require('../middleware/auth.middleware');

// Public read routes with optional elevated super_admin visibility for inactive records
router.get('/', optionalAuthenticateAdmin, serviceController.getServices);
router.get('/slug/:slug', optionalAuthenticateAdmin, serviceController.getServiceBySlug);
router.get('/:id', optionalAuthenticateAdmin, serviceController.getServiceById);

// Administrative write routes
// Creation and updates are permitted for both super_admin and branch_admin
router.post('/', authenticateAdmin, authorizeRoles('super_admin', 'branch_admin'), serviceController.createService);
router.put('/:id', authenticateAdmin, authorizeRoles('super_admin', 'branch_admin'), serviceController.updateService);

// Deactivation/reactivation status changes are strictly restricted to super_admin
router.patch('/:id/status', authenticateAdmin, authorizeRoles('super_admin'), serviceController.toggleServiceStatus);

module.exports = router;
