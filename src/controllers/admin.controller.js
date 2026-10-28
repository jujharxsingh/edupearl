/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Administrator Profile Controller
 * ============================================================================
 * 
 * Provides handlers for protected administrative profile endpoints.
 * 
 * Security Guarantees:
 * 1. Requires prior execution of `authenticateAdmin` middleware.
 * 2. Returns only safe, non-sensitive identity metadata.
 * 3. Never exposes password hashes, internal session tokens, or raw secrets.
 * ============================================================================
 */

/**
 * Returns the currently authenticated administrator profile
 * Route: GET /api/admin/me
 */
const getMe = (req, res) => {
  // req.admin is safely populated by the authenticateAdmin middleware
  res.status(200).json({
    status: 'ok',
    admin: req.admin
  });
};

module.exports = {
  getMe
};
