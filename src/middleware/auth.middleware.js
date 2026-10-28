/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Authentication Middleware
 * ============================================================================
 * 
 * Protects administrative routes by verifying JWT tokens transmitted via
 * secure HttpOnly cookies (or Authorization Bearer headers).
 * 
 * Security Guarantees:
 * 1. Validates token signature and expiration.
 * 2. Cross-references the active state in the database using parameterized SQL.
 * 3. Immediately rejects deactivated or nonexistent administrators.
 * 4. Attaches safe administrator metadata to `req.admin`.
 * 5. Masks internal error details and never logs raw tokens or credentials.
 * 6. Token Revocation Context:
 *    Clearing the cookie expires the client browser cookie, but does not invalidate
 *    a copied stateless JWT if submitted as a Bearer token prior to its expiration.
 *    Immediate server-side revocation would require tracking token versions
 *    or a revocation denylist in MySQL (pending schema approval).
 * ============================================================================
 */

const pool = require('../config/db');
const {
  AUTH_COOKIE_NAME,
  getClearCookieOptions,
  verifyToken
} = require('../utils/token');

/**
 * Middleware to authenticate requests to administrator endpoints.
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    // 1. Extract token from HttpOnly cookie or Authorization header
    let token = req.cookies ? req.cookies[AUTH_COOKIE_NAME] : null;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Please log in to access this resource.'
      });
    }

    // 2. Verify token signature and expiration
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (tokenErr) {
      // Clear invalid/expired cookie on client
      res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());

      if (tokenErr.status === 500) {
        // Forward configuration errors (e.g. JWT_SECRET missing) to centralized error handler
        return next(tokenErr);
      }

      return res.status(401).json({
        error: 'Unauthorized',
        message: tokenErr.name === 'TokenExpiredError'
          ? 'Session has expired. Please log in again.'
          : 'Invalid authentication token. Please log in again.'
      });
    }

    // 3. Verify administrator existence and active status in database
    const [rows] = await pool.query(
      'SELECT id, username, email, full_name, role, is_active FROM admins WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (rows.length === 0) {
      res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Administrator account no longer exists.'
      });
    }

    const admin = rows[0];

    // 4. Reject inactive/deactivated administrator accounts
    if (!admin.is_active) {
      res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Account is deactivated. Access denied.'
      });
    }

    // 5. Attach safe administrator profile to request object
    req.admin = {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role
    };

    next();
  } catch (error) {
    // Pass unexpected internal/database errors to centralized error handler
    next(error);
  }
};

/**
 * Role-Based Access Control (RBAC) Authorization Middleware.
 * Reusable middleware that checks whether the authenticated administrator possesses
 * one of the permitted roles.
 * 
 * Must be mounted AFTER `authenticateAdmin` in the route middleware pipeline.
 * 
 * @param {...string} allowedRoles - Permitted roles (e.g. 'super_admin', 'branch_admin', 'counselor')
 * @returns {import('express').RequestHandler}
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // 1. Guard against unauthenticated invocation (authenticateAdmin was skipped or failed)
    if (!req.admin) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Please log in.'
      });
    }

    // 2. Check if administrator's role matches any allowed role
    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied. You do not have permission to access this resource.'
      });
    }

    next();
  };
};

/**
 * Optional Authentication Middleware.
 * Inspects cookies or Authorization headers for an administrator JWT.
 * If a valid token is present and the administrator is active in the database,
 * populates `req.admin`. If no token is provided, or if the token is invalid/expired,
 * the request simply proceeds as unauthenticated without throwing 401.
 * 
 * Used for public endpoints that support elevated view privileges for super_admins
 * (such as viewing inactive records via ?includeInactive=true).
 */
const optionalAuthenticateAdmin = async (req, res, next) => {
  try {
    let token = req.cookies ? req.cookies[AUTH_COOKIE_NAME] : null;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next();
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      // If token is invalid or expired, continue as unauthenticated public visitor
      return next();
    }

    const [rows] = await pool.query(
      'SELECT id, username, email, full_name, role, is_active FROM admins WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (rows.length > 0 && rows[0].is_active) {
      const admin = rows[0];
      req.admin = {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role
      };
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticateAdmin,
  authorizeRoles,
  optionalAuthenticateAdmin
};

