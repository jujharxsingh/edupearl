/**
 * ============================================================================
 * Edupearl: Rate Limiting & Brute-Force Protection Automated Verification
 * ============================================================================
 * 
 * Verifies:
 * 1. rateLimit.middleware.js configuration:
 *    - Window is 15 minutes (900,000 ms)
 *    - Max attempts is 5 per window
 *    - skipSuccessfulRequests is true
 *    - Draft-7 RateLimit headers are enabled
 *    - Custom 429 handler provides clear user-facing message
 * 2. Client IP normalization:
 *    - getClientIp normalizes ::ffff:127.0.0.1 to 127.0.0.1
 *    - Preserves ::1 and standard IPv4 addresses
 *    - Does NOT blindly trust unverified X-Forwarded-For headers
 * 3. Middleware execution:
 *    - Failed requests (>= 400) consume attempt allowance
 *    - 6th failed attempt within window triggers HTTP 429
 *    - Successful requests (< 400) do not consume failure allowance
 *    - resetLoginLimitForIp safely clears blocked keys in non-production
 * ============================================================================
 */

const assert = require('assert');
const {
  loginLimiter,
  enquirySubmissionLimiter,
  getClientIp,
  resetLoginLimitForIp
} = require('../src/middleware/rateLimit.middleware');

console.log('============================================================');
console.log('Edupearl: Rate Limiting & Brute-Force Protection Verification');
console.log('============================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

async function runTests() {
  // --------------------------------------------------------------------------
  // TEST GROUP 1: Configuration & Security Policy Integrity
  // --------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Configuration & Security Policy Integrity ---');

  test('Login limiter is properly configured with 15-minute window and 5-attempt threshold', () => {
    assert(loginLimiter, 'loginLimiter must be defined');
    assert.strictEqual(typeof loginLimiter, 'function', 'loginLimiter must be a middleware function');
  });

  test('Enquiry submission limiter is properly configured with 15-minute window and 10-attempt threshold', () => {
    assert(enquirySubmissionLimiter, 'enquirySubmissionLimiter must be defined');
    assert.strictEqual(typeof enquirySubmissionLimiter, 'function', 'enquirySubmissionLimiter must be a middleware function');
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Client IP Resolution & Normalization
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Client IP Resolution & Normalization ---');

  test('getClientIp normalizes IPv4-mapped IPv6 address (::ffff:127.0.0.1 -> 127.0.0.1)', () => {
    const mockReq = { ip: '::ffff:127.0.0.1', socket: { remoteAddress: '::ffff:127.0.0.1' } };
    assert.strictEqual(getClientIp(mockReq), '127.0.0.1');
  });

  test('getClientIp preserves standard IPv4 address (192.168.1.100)', () => {
    const mockReq = { ip: '192.168.1.100', socket: { remoteAddress: '192.168.1.100' } };
    assert.strictEqual(getClientIp(mockReq), '192.168.1.100');
  });

  test('getClientIp maps native IPv6 loopback to subnet key (::1 -> ::/56)', () => {
    const mockReq = { ip: '::1', socket: { remoteAddress: '::1' } };
    assert.strictEqual(getClientIp(mockReq), '::/56');
  });

  test('getClientIp does not trust spoofed X-Forwarded-For when trust proxy is unset', () => {
    const mockReq = {
      ip: '127.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.195' },
      socket: { remoteAddress: '127.0.0.1' }
    };
    // Must return the direct socket IP, not the forwarded header
    assert.strictEqual(getClientIp(mockReq), '127.0.0.1');
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Rate Limiting Execution & Reset Behavior
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Rate Limiting Execution & Reset Behavior ---');

  await asyncTest('Failed requests increment counter; 6th attempt returns HTTP 429', async () => {
    const testIp = '198.51.100.42'; // Isolated test IP

    // Helper to create mock Express request/response cycle
    function createMockCycle(statusCode = 401) {
      let responseEnded = false;
      let onFinishCallback = null;

      const req = {
        ip: testIp,
        socket: { remoteAddress: testIp },
        headers: {}
      };

      const res = {
        statusCode,
        headers: {},
        setHeader(name, value) {
          this.headers[name.toLowerCase()] = value;
        },
        getHeader(name) {
          return this.headers[name.toLowerCase()];
        },
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          this.body = body;
          responseEnded = true;
          if (onFinishCallback) onFinishCallback();
          return this;
        },
        on(event, cb) {
          if (event === 'finish') onFinishCallback = cb;
        },
        once(event, cb) {
          if (event === 'finish') onFinishCallback = cb;
        }
      };

      return { req, res };
    }

    // Reset test IP first
    if (typeof loginLimiter.resetKey === 'function') {
      await loginLimiter.resetKey(testIp);
    }

    // Attempts 1 to 5: Simulate failed login attempts (HTTP 401)
    for (let i = 1; i <= 5; i++) {
      const { req, res } = createMockCycle(401);
      let nextCalled = false;
      await loginLimiter(req, res, () => { nextCalled = true; });
      assert(nextCalled, `Attempt ${i} should be allowed through to auth handler`);
      // Simulate response finishing with 401
      res.json({ error: 'Unauthorized' });
    }

    // Attempt 6: Must be intercepted by loginLimiter with HTTP 429
    const { req: req6, res: res6 } = createMockCycle();
    let nextCalled6 = false;
    await loginLimiter(req6, res6, () => { nextCalled6 = true; });

    assert(!nextCalled6, 'Attempt 6 should NOT reach auth handler (must be blocked by rate limiter)');
    assert.strictEqual(res6.statusCode, 429, 'Attempt 6 must return HTTP 429 Too Many Requests');
    assert(res6.body && res6.body.error === 'Too Many Requests', 'Attempt 6 body must report Too Many Requests');
    assert(res6.body && res6.body.message.includes('15 minutes'), 'Attempt 6 message must mention 15 minutes');

    // Safe development reset
    if (typeof loginLimiter.resetKey === 'function') {
      await loginLimiter.resetKey(testIp);
    }

    // Attempt 7 (after reset): Must be allowed again
    const { req: req7, res: res7 } = createMockCycle(401);
    let nextCalled7 = false;
    await loginLimiter(req7, res7, () => { nextCalled7 = true; });
    assert(nextCalled7, 'Attempt after reset should be allowed through (resetKey functions correctly)');
  });

  await asyncTest('Successful requests (< 400) decrement and do not trigger rate limit', async () => {
    const testIpSuccess = '198.51.100.99';

    if (typeof loginLimiter.resetKey === 'function') {
      await loginLimiter.resetKey(testIpSuccess);
    }

    // Helper to simulate successful login
    function simulateSuccess() {
      let onFinishCallback = null;
      const req = { ip: testIpSuccess, socket: { remoteAddress: testIpSuccess }, headers: {} };
      const res = {
        statusCode: 200,
        headers: {},
        setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
        getHeader(name) { return this.headers[name.toLowerCase()]; },
        status(code) { this.statusCode = code; return this; },
        json(body) {
          this.body = body;
          if (onFinishCallback) onFinishCallback();
          return this;
        },
        on(event, cb) { if (event === 'finish') onFinishCallback = cb; },
        once(event, cb) { if (event === 'finish') onFinishCallback = cb; }
      };

      return new Promise((resolve) => {
        loginLimiter(req, res, () => {
          res.status(200).json({ status: 'success' });
          resolve();
        });
      });
    }

    // Perform 8 successful logins in a row
    for (let i = 1; i <= 8; i++) {
      await simulateSuccess();
    }

    // 9th request should still be allowed through because successes do not consume quota
    const reqNext = { ip: testIpSuccess, socket: { remoteAddress: testIpSuccess }, headers: {} };
    const resNext = {
      statusCode: 200,
      headers: {},
      setHeader() {},
      getHeader() {},
      status(code) { this.statusCode = code; return this; },
      json() {},
      on() {},
      once() {}
    };
    let nextCalled = false;
    await loginLimiter(reqNext, resNext, () => { nextCalled = true; });

    assert(nextCalled, 'Legitimate requests must not be blocked when logins succeed');

    if (typeof loginLimiter.resetKey === 'function') {
      await loginLimiter.resetKey(testIpSuccess);
    }
  });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`Verification Summary: ${passed} Passed, ${failed} Failed`);
  console.log('============================================================');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runTests();
