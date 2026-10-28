/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Branch Routes (Milestone 5, Phase 2)
 * ============================================================================
 * 
 * Defines endpoints mounted under /api/branches:
 *   GET   /api/branches            - Public list of active branches (super_admin can view all via ?includeInactive=true)
 *   GET   /api/branches/:id        - Public single active branch (super_admin can view inactive via ?includeInactive=true)
 *   POST  /api/branches            - Create branch (super_admin only)
 *   PUT   /api/branches/:id        - Update branch (super_admin only)
 *   PATCH /api/branches/:id/status - Toggle/set branch active status (super_admin only, soft-delete)
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branch.controller');
const {
  authenticateAdmin,
  authorizeRoles,
  optionalAuthenticateAdmin
} = require('../middleware/auth.middleware');

// Public read routes with optional elevated super_admin visibility for inactive records
router.get('/', optionalAuthenticateAdmin, branchController.getBranches);
router.get('/:id', optionalAuthenticateAdmin, branchController.getBranchById);

// Administrative write routes (Strictly restricted to super_admin)
router.post('/', authenticateAdmin, authorizeRoles('super_admin'), branchController.createBranch);
router.put('/:id', authenticateAdmin, authorizeRoles('super_admin'), branchController.updateBranch);
router.patch('/:id/status', authenticateAdmin, authorizeRoles('super_admin'), branchController.toggleBranchStatus);

module.exports = router;
