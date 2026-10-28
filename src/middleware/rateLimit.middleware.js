/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Rate Limiting Middleware
 * ============================================================================
 * 
 * Protects sensitive authentication routes from automated brute-force,
 * credential-stuffing, and denial-of-service attacks.
 * 
 * Viva / Theoretical Concepts for BCA:
 * 1. Brute-Force Mitigation: Limits the frequency of requests originating from
 *    a single client IP to prevent exhaustive credential guessing.
 * 2. skipSuccessfulRequests: Legitimate users with correct credentials are not
 *    penalized. Only failed authentication requests (HTTP status >= 400) count
 *    towards the rate limit threshold.
 * 3. Trust Proxy Architecture Consideration:
 *    Setting `app.set('trust proxy', ...)` blindly can permit client IP spoofing
 *    via crafted `X-Forwarded-For` headers unless the exact upstream proxy/load
 *    balancer topology (e.g. AWS ALB, Cloudflare, Nginx) is known and trusted.
 *    In accordance with secure defaults, `trust proxy` is left unset in Express,
 *    and rate limiting utilizes direct client socket addresses until production
 *    proxy topology is formally established.
 * ============================================================================
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/**
 * Safely resolves and normalizes client IP address for rate limiting.
 * Handles IPv4-mapped IPv6 loopbacks (e.g. ::ffff:127.0.0.1 -> 127.0.0.1) and IPv6 loopback (::1).
 * In accordance with secure defaults, it relies on req.ip / direct socket connection
 * to prevent IP spoofing via unverified X-Forwarded-For headers.
 * 
 * @param {import('express').Request} req
 * @returns {string} Normalized IP key
 */
const getClientIp = (req) => {
  let ip = req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ipKeyGenerator(ip);
};

/**
 * Factory to create an isolated login rate limiter instance.
 * Allows test suites to use an independent in-memory store so automated testing
 * does not consume or interfere with live development or browser login attempts.
 * 
 * Rules:
 * - Window: 15 minutes (900,000 ms)
 * - Max: 5 failed attempts per IP within the window
 * - Successful logins (HTTP < 400) are decremented / not counted against the quota
 * - Returns HTTP 429 Too Many Requests when threshold is exceeded
 * 
 * @param {object} [customOptions] - Optional configuration overrides (e.g. custom store)
 * @returns {import('express').RequestHandler}
 */
const createLoginLimiter = (customOptions = {}) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5, // Maximum 5 failed attempts per IP
    keyGenerator: getClientIp,
    skipSuccessfulRequests: true, // Only failed attempts consume allowance
    standardHeaders: 'draft-7', // Draft-7 RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* legacy headers
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json({
        error: 'Too Many Requests',
        message: 'Too many failed login attempts from this IP address. Please try again after 15 minutes.'
      });
    },
    ...customOptions
  });
};

/**
 * Singleton Login Rate Limiter for live application routes.
 */
const loginLimiter = createLoginLimiter();

/**
 * Public Enquiry Submission Rate Limiter.
 * Protects public POST /api/enquiries from spam, automated form flooding,
 * and denial-of-service abuse.
 * 
 * Rules:
 * - Window: 15 minutes (900,000 ms)
 * - Max: 10 enquiry submissions per client IP within the window
 * - All attempts (success and failure) consume allowance to stop bot lead flooding
 * - Returns HTTP 429 Too Many Requests when threshold is exceeded
 */
const enquirySubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // Maximum 10 submissions per IP
  keyGenerator: getClientIp,
  standardHeaders: 'draft-7', // Draft-7 RateLimit-* headers
  legacyHeaders: false, // Disable legacy X-RateLimit-* headers
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json({
      error: 'Too Many Requests',
      message: 'Too many enquiries submitted from this IP address. Please try again after 15 minutes.'
    });
  }
});

/**
 * Resets the rate limit counter for a specific IP address in non-production environments.
 * Safe utility function for development and automated test suites.
 * NEVER exposed as a public endpoint.
 * 
 * @param {string} ip - IP address to reset (defaults to '127.0.0.1')
 * @returns {Promise<void>}
 */
const resetLoginLimitForIp = async (ip = '127.0.0.1') => {
  if (process.env.NODE_ENV !== 'production' && typeof loginLimiter.resetKey === 'function') {
    await loginLimiter.resetKey(ip);
    if (ip === '127.0.0.1') {
      await loginLimiter.resetKey('::1');
      await loginLimiter.resetKey('::ffff:127.0.0.1');
    }
  }
};

module.exports = {
  createLoginLimiter,
  loginLimiter,
  enquirySubmissionLimiter,
  getClientIp,
  resetLoginLimitForIp
};

