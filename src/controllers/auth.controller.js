/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Authentication Controller
 * ============================================================================
 * 
 * Handles administrator authentication endpoints:
 *   POST /api/auth/login  - Authenticates administrator and sets secure cookie
 *   POST /api/auth/logout - Clears authentication cookie
 * 
 * Security Principles:
 * 1. Parameterized SQL queries to eliminate SQL injection risks.
 * 2. Constant-time password verification using bcryptjs.
 * 3. Generic authentication error messages to prevent account enumeration.
 * 4. Inactive accounts are strictly rejected.
 * 5. Password hashes are never returned to clients or logged.
 * 6. Authentication tokens are issued in HttpOnly, SameSite, Secure cookies.
 * 7. Token Revocation Context:
 *    Clearing the cookie in logout removes the credentials from the client browser.
 *    However, in a stateless JWT architecture, a copied or exfiltrated token (e.g.
 *    used via an Authorization Bearer header) remains cryptographically valid until
 *    its expiration timestamp. Complete immediate revocation would require tracking
 *    revocations or token versions in the database (e.g. adding a `token_version`
 *    column to the `admins` table).
 * ============================================================================
 */

const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getClearCookieOptions,
  generateToken
} = require('../utils/token');

/**
 * Administrator Login Handler
 * Route: POST /api/auth/login
 * 
 * Accepts:
 *   - identifier: Username (e.g., 'jujhar') or email ('jujhar@edupearl.in')
 *   - password: Administrator password
 */
const login = async (req, res, next) => {
  try {
    const body = req.body || {};
    const rawIdentifier = body.identifier || body.username || body.email;
    const rawPassword = body.password;

    // 1. Input presence and format validation
    if (!rawIdentifier || typeof rawIdentifier !== 'string' || !rawPassword || typeof rawPassword !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username or email and password are required.'
      });
    }

    const identifier = rawIdentifier.trim();
    const password = rawPassword;

    if (identifier.length === 0 || password.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username or email and password cannot be empty.'
      });
    }

    if (identifier.length > 100 || password.length > 255) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Input length exceeds permitted limit.'
      });
    }

    // 2. Query administrator using parameterized SQL (matches username or email)
    const [rows] = await pool.query(
      `SELECT id, username, email, password_hash, full_name, role, is_active
       FROM admins
       WHERE username = ? OR email = ?
       LIMIT 1`,
      [identifier, identifier]
    );

    // Generic error message for both non-existent user and wrong password
    const genericAuthError = {
      error: 'Unauthorized',
      message: 'Invalid username, email, or password.'
    };

    // 3. User existence check
    if (rows.length === 0) {
      return res.status(401).json(genericAuthError);
    }

    const admin = rows[0];

    // 4. Verify password with bcryptjs against stored hash
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json(genericAuthError);
    }

    // 5. Reject inactive administrator accounts
    if (!admin.is_active) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Account is inactive. Please contact a super administrator.'
      });
    }

    // 6. Update last login timestamp in database
    await pool.query(
      'UPDATE admins SET last_login_at = NOW() WHERE id = ?',
      [admin.id]
    );

    // 7. Generate JWT payload (safe claims only, NEVER include password_hash)
    const tokenPayload = {
      id: admin.id,
      username: admin.username,
      role: admin.role
    };

    const token = generateToken(tokenPayload);

    // 8. Attach secure HttpOnly cookie to response
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    // 9. Return safe administrator info without sensitive data
    res.status(200).json({
      status: 'success',
      message: 'Login successful.',
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role
      }
    });
  } catch (error) {
    // Forward unexpected configuration, database, or server errors to centralized error handler
    next(error);
  }
};

/**
 * Administrator Logout Handler
 * Route: POST /api/auth/logout
 * 
 * Clears the client-side authentication cookie.
 * Note: Clearing the cookie does not invalidate a copied or exfiltrated stateless JWT
 * if presented directly via an Authorization Bearer header before its expiration.
 */
const logout = (req, res) => {
  // Clear the authentication cookie using matching path and security flags
  res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully.'
  });
};

module.exports = {
  login,
  logout
};
