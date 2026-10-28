/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Token & Cookie Utility Helper
 * ============================================================================
 * 
 * Provides centralized functions for JSON Web Token (JWT) signing, verification,
 * and secure HTTP-only cookie configuration.
 * 
 * Viva / Theoretical Concepts for BCA:
 * 1. JSON Web Tokens (RFC 7519): Compact, URL-safe claims representation.
 *    Consists of Header, Payload, and Signature.
 * 
 * 2. Secrets Management & Zero-Fallback Policy:
 *    Hardcoded fallback secrets in source code are a major vulnerability (CWE-798).
 *    Authentication MUST fail safely at startup or runtime if JWT_SECRET is
 *    missing or lacks sufficient cryptographic strength (minimum 32 characters
 *    for HMAC-SHA256). Secrets are never logged or exposed to clients.
 * 
 * 3. Cookie Flags & Defense-in-Depth:
 *    - httpOnly: true -> Inaccessible to document.cookie, mitigating XSS token theft.
 *    - sameSite: 'lax' -> Blocks cookie transmission on cross-site state-changing
 *      requests (POST/PUT/DELETE forms), mitigating CSRF.
 *    - secure: true (in production) -> Enforces TLS/HTTPS-only transmission.
 *    - path: '/' -> Scoped to application root.
 * 
 * 4. Token Revocation Limitations in Stateless JWT:
 *    Clearing a cookie on the client tells the browser to discard the cookie.
 *    However, if a stateless JWT has been copied or exfiltrated (e.g. from an
 *    Authorization Bearer header), the token remains cryptographically valid
 *    until its expiration timestamp.
 * 
 *    Smallest Safe Approach for Token Revocation (Academic Project):
 *    Add an integer column `token_version` to the `admins` table:
 *      ALTER TABLE admins ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 1;
 *    Include `tokenVersion: admin.token_version` in the JWT payload.
 *    On logout, increment `token_version` in MySQL (`token_version = token_version + 1`).
 *    In the auth middleware, reject any token where `decoded.tokenVersion !== admin.token_version`.
 *    This revokes all issued tokens for that administrator immediately without
 *    requiring Redis or external cache infrastructure.
 *    (Pending schema change approval).
 * ============================================================================
 */

const jwt = require('jsonwebtoken');

const AUTH_COOKIE_NAME = 'edupearl_token';
const MIN_SECRET_LENGTH = 32;

/**
 * Validates and retrieves the JWT_SECRET from environment variables.
 * Fails safely with a clear configuration error if missing or insufficient.
 * NEVER prints or leaks the secret value.
 * 
 * @returns {string} Validated secret string
 * @throws {Error} If secret is missing or too short
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    const error = new Error(
      'Configuration Error: JWT_SECRET environment variable is missing. ' +
      'Authentication cannot operate until a valid JWT_SECRET is configured in your .env file.'
    );
    error.status = 500;
    throw error;
  }

  const trimmed = secret.trim();

  if (trimmed.length < MIN_SECRET_LENGTH) {
    const error = new Error(
      `Configuration Error: JWT_SECRET is insufficient in strength (must be at least ${MIN_SECRET_LENGTH} characters long). ` +
      'Please configure a strong, cryptographically secure secret in your .env file.'
    );
    error.status = 500;
    throw error;
  }

  return trimmed;
};

/**
 * Checks JWT_SECRET configuration health without throwing.
 * Safe for startup diagnostic logging without revealing the secret.
 * 
 * @returns {{ valid: boolean, message?: string }}
 */
const checkJwtConfiguration = () => {
  try {
    getJwtSecret();
    return { valid: true };
  } catch (err) {
    return { valid: false, message: err.message };
  }
};

/**
 * Generates cookie configuration options for issuing an authentication cookie.
 * @returns {import('express').CookieOptions}
 */
const getAuthCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    // 2 hours in milliseconds (matches default JWT_EXPIRES_IN)
    maxAge: 2 * 60 * 60 * 1000,
    path: '/'
  };
};

/**
 * Generates cookie options for clearing an authentication cookie upon logout.
 * Explicitly omits maxAge so the browser immediately expires the cookie (Expires: 1970).
 * Path, httpOnly, secure, and sameSite match the original cookie options.
 * @returns {import('express').CookieOptions}
 */
const getClearCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/'
  };
};

/**
 * Signs a JWT with the administrator payload.
 * Validates secret strength dynamically; fails safely if unconfigured.
 * 
 * @param {object} payload - Safe administrator claims (id, username, role)
 * @returns {string} - Signed JWT
 */
const generateToken = (payload) => {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '2h';

  return jwt.sign(payload, secret, {
    expiresIn
  });
};

/**
 * Verifies a JWT token.
 * Validates secret strength dynamically; fails safely if unconfigured.
 * 
 * @param {string} token - JWT string to verify
 * @returns {object} - Decoded claims if valid
 * @throws {Error} - If token is expired, invalid, or secret is misconfigured
 */
const verifyToken = (token) => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
};

module.exports = {
  AUTH_COOKIE_NAME,
  MIN_SECRET_LENGTH,
  getJwtSecret,
  checkJwtConfiguration,
  getAuthCookieOptions,
  getClearCookieOptions,
  generateToken,
  verifyToken
};
