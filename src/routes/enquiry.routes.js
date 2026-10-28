/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Enquiries Routes (Milestone 5, Phase 4)
 * ============================================================================
 * 
 * Defines endpoints mounted under /api/enquiries:
 *   POST  /api/enquiries                     - Public enquiry submission (rate limited)
 *   GET   /api/enquiries                     - Authenticated listing with pagination & filters
 *   GET   /api/enquiries/reference/:reference - Lookup enquiry by reference tracking code
 *   GET   /api/enquiries/:id                 - Lookup enquiry by numeric ID
 *   PATCH /api/enquiries/:id/status          - Update status and counselor notes
 *   PATCH /api/enquiries/:id/branch          - Reassign preferred branch (super_admin & branch_admin)
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const enquiryController = require('../controllers/enquiry.controller');
const { enquirySubmissionLimiter } = require('../middleware/rateLimit.middleware');
const {
  authenticateAdmin,
  authorizeRoles
} = require('../middleware/auth.middleware');

// Public route: client lead submission (with rate limiting and honeypot protection)
router.post('/', enquirySubmissionLimiter, enquiryController.createEnquiry);

// Administrative routes: authenticated staff (super_admin, branch_admin, counselor)
router.get(
  '/',
  authenticateAdmin,
  authorizeRoles('super_admin', 'branch_admin', 'counselor'),
  enquiryController.getEnquiries
);

router.get(
  '/reference/:reference',
  authenticateAdmin,
  authorizeRoles('super_admin', 'branch_admin', 'counselor'),
  enquiryController.getEnquiryByReference
);

router.get(
  '/:id',
  authenticateAdmin,
  authorizeRoles('super_admin', 'branch_admin', 'counselor'),
  enquiryController.getEnquiryById
);

router.patch(
  '/:id/status',
  authenticateAdmin,
  authorizeRoles('super_admin', 'branch_admin', 'counselor'),
  enquiryController.updateEnquiryStatus
);

// Administrative route: Branch reassignment (restricted to super_admin and branch_admin only)
router.patch(
  '/:id/branch',
  authenticateAdmin,
  authorizeRoles('super_admin', 'branch_admin'),
  enquiryController.reassignEnquiryBranch
);

module.exports = router;
