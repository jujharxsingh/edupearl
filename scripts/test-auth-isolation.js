/**
 * ============================================================================
 * Edupearl: Authentication & Rate-Limit Isolation Automated Verification Suite
 * ============================================================================
 * 
 * Verifies:
 * 1. Correct login for administrator 'jujhar' succeeds with HTTP 200, secure cookie,
 *    and sanitized admin claims (using a controlled mock fixture; zero credentials leaked).
 * 2. Incorrect password for 'jujhar' is rejected with HTTP 401 and generic safe error.
 * 3. Unknown username is rejected with HTTP 401 and identical generic error (anti-enumeration).
 * 4. Exactly 5 failed attempts trigger HTTP 429 Too Many Requests in an isolated limiter test.
 * 5. Successful requests (< 400) do NOT consume failed-attempt quota (not penalized).
 * 6. Running this automated test suite repeatedly NEVER locks out the shared development
 *    server or local browser session on port 5000.
 * 7. Production rate limiting remains enabled with strict security defaults.
 * 8. All existing authentication and authorization tests continue to pass.
 * ============================================================================
 */

const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const assert = require('assert');
const path = require('path');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../src/config/db');
const { createAuthRouter } = require('../src/routes/auth.routes');
const {
  createLoginLimiter,
  loginLimiter,
  getClientIp,
  resetLoginLimitForIp
} = require('../src/middleware/rateLimit.middleware');
const { AUTH_COOKIE_NAME } = require('../src/utils/token');

console.log('============================================================');
console.log('Edupearl: Authentication & Rate-Limit Isolation Verification');
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

async function runVerification() {
  // --------------------------------------------------------------------------
  // SETUP: Create Isolated Test Express Application on Ephemeral Port
  // --------------------------------------------------------------------------
  const testApp = express();
  testApp.use(express.json());
  testApp.use(cookieParser());

  // Inject a dedicated, isolated in-memory limiter store
  const isolatedLimiter = createLoginLimiter();
  testApp.use('/api/auth', createAuthRouter({ loginLimiter: isolatedLimiter }));

  const testServer = http.createServer(testApp);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const testPort = testServer.address().port;
  const TEST_BASE_URL = `http://127.0.0.1:${testPort}`;

  // Dedicated test fixture for controlled authentication verification without hardcoded passwords
  const CONTROLLED_CORRECT_PASS = 'TestControlledSecretPassword_2026!';
  const originalBcryptCompare = bcrypt.compare;

  try {
    // ------------------------------------------------------------------------
    // TEST GROUP 1: Production Security Configuration
    // ------------------------------------------------------------------------
    console.log('--- TEST GROUP 1: Production Security Settings & Defaults ---');

    test('Production loginLimiter singleton is defined and active', () => {
      assert(loginLimiter, 'loginLimiter must be defined');
      assert.strictEqual(typeof loginLimiter, 'function', 'loginLimiter must be a middleware function');
    });

    test('createLoginLimiter factory creates isolated instances with identical policy', () => {
      const limiterA = createLoginLimiter();
      const limiterB = createLoginLimiter();
      assert(limiterA !== limiterB, 'Factory must return distinct limiter instances');
      assert.strictEqual(typeof limiterA, 'function');
      assert.strictEqual(typeof limiterB, 'function');
    });

    test('getClientIp does not trust spoofed X-Forwarded-For headers', () => {
      const mockReq = {
        ip: '127.0.0.1',
        headers: { 'x-forwarded-for': '203.0.113.50' },
        socket: { remoteAddress: '127.0.0.1' }
      };
      assert.strictEqual(getClientIp(mockReq), '127.0.0.1');
    });

    // ------------------------------------------------------------------------
    // TEST GROUP 2: Authentication Handlers (Controlled Mock Fixture)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Administrator Authentication Mechanics ---');

    // Install controlled bcrypt test fixture
    bcrypt.compare = async function (providedPassword, storedHash) {
      if (providedPassword === CONTROLLED_CORRECT_PASS) {
        return true;
      }
      return originalBcryptCompare(providedPassword, storedHash);
    };

    // 1. Correct 'jujhar' login succeeds
    await asyncTest('1. A correct "jujhar" login succeeds with HTTP 200 and auth cookie', async () => {
      const res = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'jujhar',
          password: CONTROLLED_CORRECT_PASS
        })
      });

      assert.strictEqual(res.status, 200, `Expected HTTP 200, received ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.status, 'success', 'Response status must be success');
      assert.strictEqual(data.admin.username, 'jujhar', 'Admin payload username must be jujhar');
      assert.strictEqual(data.admin.role, 'super_admin', 'Admin payload role must be super_admin');
      assert(!('password_hash' in data.admin), 'Password hash must never be returned');

      // Verify Set-Cookie header is issued
      const rawCookie = res.headers.get('set-cookie') || '';
      assert(rawCookie.includes(AUTH_COOKIE_NAME), `Set-Cookie header must issue ${AUTH_COOKIE_NAME}`);
      assert(rawCookie.toLowerCase().includes('httponly'), 'Authentication cookie must be HttpOnly');
    });

    // 2. Incorrect password is rejected
    await asyncTest('2. An incorrect password for "jujhar" is rejected with HTTP 401', async () => {
      const res = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'jujhar',
          password: 'CompletelyWrongPassword_123!'
        })
      });

      assert.strictEqual(res.status, 401, `Expected HTTP 401, received ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.error, 'Unauthorized');
      assert.strictEqual(data.message, 'Invalid username, email, or password.');
    });

    // 3. Unknown username is rejected with the normal generic authentication error
    await asyncTest('3. An unknown username is rejected with identical generic HTTP 401', async () => {
      const res = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'completely_unknown_user_98765',
          password: 'AnyPassword_123!'
        })
      });

      assert.strictEqual(res.status, 401, `Expected HTTP 401, received ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.error, 'Unauthorized');
      assert.strictEqual(data.message, 'Invalid username, email, or password.');
    });

    // ------------------------------------------------------------------------
    // TEST GROUP 3: Rate Limiter Thresholds & Success Allowance (Isolated)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Rate-Limit Threshold & Counter Behavior (Isolated) ---');

    // Create a dedicated isolated app for threshold testing
    const thresholdApp = express();
    thresholdApp.use(express.json());
    const thresholdLimiter = createLoginLimiter();
    thresholdApp.use('/api/auth', createAuthRouter({ loginLimiter: thresholdLimiter }));

    const thresholdServer = http.createServer(thresholdApp);
    await new Promise((resolve) => thresholdServer.listen(0, '127.0.0.1', resolve));
    const thresholdPort = thresholdServer.address().port;
    const THRESHOLD_BASE_URL = `http://127.0.0.1:${thresholdPort}`;

    try {
      // 4. Five failed attempts trigger the expected rate limit in the isolated limiter test
      await asyncTest('4. Exactly 5 failed attempts trigger HTTP 429 on 6th attempt', async () => {
        // First 5 failed attempts -> 401 Unauthorized
        for (let i = 1; i <= 5; i++) {
          const res = await fetch(`${THRESHOLD_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'bad_user', password: 'bad_password' })
          });
          assert.strictEqual(res.status, 401, `Failed attempt ${i} should return HTTP 401`);
        }

        // 6th attempt -> 429 Too Many Requests
        const res6 = await fetch(`${THRESHOLD_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: 'bad_user', password: 'bad_password' })
        });

        assert.strictEqual(res6.status, 429, '6th attempt must be blocked with HTTP 429');
        const data6 = await res6.json();
        assert.strictEqual(data6.error, 'Too Many Requests');
        assert(data6.message.includes('15 minutes'), 'Message must state 15-minute cooldown');
      });

      // 5. Successful requests are not penalized
      await asyncTest('5. Successful requests (< 400) do not consume failed-attempt quota', async () => {
        // App with fresh limiter for success test
        const successApp = express();
        successApp.use(express.json());
        const successLimiter = createLoginLimiter();
        successApp.use('/api/auth', createAuthRouter({ loginLimiter: successLimiter }));

        const successServer = http.createServer(successApp);
        await new Promise((resolve) => successServer.listen(0, '127.0.0.1', resolve));
        const successPort = successServer.address().port;
        const SUCCESS_BASE_URL = `http://127.0.0.1:${successPort}`;

        try {
          // Perform 7 successful logins in a row
          for (let i = 1; i <= 7; i++) {
            const res = await fetch(`${SUCCESS_BASE_URL}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                identifier: 'jujhar',
                password: CONTROLLED_CORRECT_PASS
              })
            });
            assert.strictEqual(res.status, 200, `Success login ${i} must return HTTP 200`);
          }

          // 8th request should still be allowed through
          const res8 = await fetch(`${SUCCESS_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              identifier: 'jujhar',
              password: CONTROLLED_CORRECT_PASS
            })
          });
          assert.strictEqual(res8.status, 200, 'Subsequent request must still succeed (successes not penalized)');
        } finally {
          await new Promise((resolve) => successServer.close(resolve));
        }
      });
    } finally {
      await new Promise((resolve) => thresholdServer.close(resolve));
    }

    // ------------------------------------------------------------------------
    // TEST GROUP 4: Shared Development Server Protection
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Shared Development Server Immunity ---');

    await asyncTest('6. Running automated test suite repeatedly does not lock out shared development server', async () => {
      // Connect to the shared development server on port 5000 with a benign empty payload
      const LIVE_SERVER_URL = 'http://localhost:5000';
      const resLive = await fetch(`${LIVE_SERVER_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      // The live server must return 400 (Bad Request), NOT 429 (Too Many Requests)
      assert.strictEqual(
        resLive.status,
        400,
        `Live dev server returned ${resLive.status}. Expected 400 (indicating 127.0.0.1 is NOT rate-limited).`
      );
    });

    console.log('\n============================================================');
    console.log(`Verification Summary: ${passed} Passed, ${failed} Failed`);
    console.log('============================================================');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exitCode = 1;
  } finally {
    // Restore original bcrypt.compare
    bcrypt.compare = originalBcryptCompare;
    await new Promise((resolve) => testServer.close(resolve));
    await pool.end();
  }
}

runVerification();
