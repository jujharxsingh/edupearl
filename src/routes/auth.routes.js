/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Authentication Routes
 * ============================================================================
 * 
 * Defines endpoints mounted under /api/auth:
 *   POST /api/auth/login  - Authenticate administrator & set session cookie
 *   POST /api/auth/logout - Terminate session & clear cookie
 * ============================================================================
 */

const express = require('express');
const authController = require('../controllers/auth.controller');
const { loginLimiter: defaultLoginLimiter } = require('../middleware/rateLimit.middleware');

/**
 * Creates an authentication router instance.
 * Allows test suites to inject an isolated rate limiter instance without modifying
 * the live server's shared rate-limiting store.
 * 
 * @param {object} [options]
 * @param {import('express').RequestHandler} [options.loginLimiter]
 * @returns {import('express').Router}
 */
const createAuthRouter = (options = {}) => {
  const router = express.Router();
  const limiter = options.loginLimiter || defaultLoginLimiter;

  // Public authentication endpoints (with brute-force protection on login)
  router.post('/login', limiter, authController.login);
  router.post('/logout', authController.logout);

  return router;
};

// Default router using production singleton limiter
const defaultRouter = createAuthRouter();

module.exports = defaultRouter;
module.exports.createAuthRouter = createAuthRouter;

