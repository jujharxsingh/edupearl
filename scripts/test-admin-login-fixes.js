/**
 * ============================================================================
 * Edupearl: Admin Login Autofill and Connection Reliability Automated Test
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('============================================================');
console.log('Edupearl: Admin Login Autofill & Connection Error Verification');
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

// ----------------------------------------------------------------------------
// TEST GROUP 1: HTML Markup & Form Attributes
// ----------------------------------------------------------------------------
console.log('--- TEST GROUP 1: HTML Markup & Form Attributes ---');
const loginHtmlPath = path.resolve(__dirname, '../public/admin/login.html');
const loginHtml = fs.readFileSync(loginHtmlPath, 'utf8');

test('Form has autocomplete="off"', () => {
  assert(loginHtml.includes('id="login-form"'), 'Missing #login-form');
  assert(loginHtml.includes('autocomplete="off"'), 'Form must specify autocomplete="off"');
});

test('Password input starts empty with clean text placeholder (no fake masking bullets)', () => {
  assert(!loginHtml.includes('placeholder="••••••••••••"'), 'Must not contain fake masking bullet placeholder');
  assert(loginHtml.includes('id="password"'), 'Missing #password');
  assert(loginHtml.includes('placeholder="Enter your password"'), 'Password field must have clean descriptive placeholder');
  assert(!loginHtml.match(/id="password"[^>]*value=/), 'Password input must not have hardcoded value');
});

test('Username input starts empty with no preset value', () => {
  assert(loginHtml.includes('id="identifier"'), 'Missing #identifier');
  assert(!loginHtml.match(/id="identifier"[^>]*value=/), 'Username input must not have hardcoded value');
});

test('Password visibility toggle button is preserved', () => {
  assert(loginHtml.includes('id="btn-toggle-password"'), 'Missing #btn-toggle-password');
  assert(loginHtml.includes('id="toggle-password-icon"'), 'Missing #toggle-password-icon');
});

test('No academic project references, BCA, or LPU badges on login page', () => {
  assert(!loginHtml.includes('academic-badge-footer'), 'Must not contain academic-badge-footer');
  assert(!loginHtml.includes('Academic Project Demonstration'), 'Must not contain Academic Project Demonstration');
  assert(!loginHtml.includes('LPU BCA'), 'Must not contain LPU BCA references');
});

// ----------------------------------------------------------------------------
// TEST GROUP 2: Login JavaScript Logic & Reliability
// ----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 2: Login JavaScript Logic & Reliability ---');
const loginJsPath = path.resolve(__dirname, '../public/admin/js/login.js');
const loginJs = fs.readFileSync(loginJsPath, 'utf8');

test('DOMContentLoaded explicitly clears form fields to prevent bfcache / stale prefill', () => {
  assert(loginJs.includes('form.reset()'), 'Must reset form on DOMContentLoaded');
  assert(loginJs.includes("identifierInput.value = ''"), 'Must clear identifier input');
  assert(loginJs.includes("passwordInput.value = ''"), 'Must clear password input');
});

test('Duplicate submit guard (isSubmitting) is implemented', () => {
  assert(loginJs.includes('let isSubmitting = false;'), 'Must declare isSubmitting state flag');
  assert(loginJs.includes('if (isSubmitting)'), 'Must check isSubmitting in submit handler');
  assert(loginJs.includes('isSubmitting = true;'), 'Must set isSubmitting on form submit');
  assert(loginJs.includes('isSubmitting = false;'), 'Must reset isSubmitting on error');
});

test('Login handler directly utilizes loginResult.admin without redundant getMe roundtrip', () => {
  assert(loginJs.includes('const loginResult = await window.adminApi.login(identifier, password);'), 'Must call adminApi.login');
  
  // Extract handleFormSubmit function body
  const submitFnBody = loginJs.slice(
    loginJs.indexOf('async function handleFormSubmit('),
    loginJs.indexOf('document.addEventListener(')
  );
  
  assert(!submitFnBody.includes('await window.adminApi.getMe('), 'Must NOT make redundant getMe call during login flow');
  assert(submitFnBody.includes('loginResult.admin'), 'Must directly use loginResult.admin');
});

test('Password visibility toggle handler is preserved', () => {
  assert(loginJs.includes('function initPasswordToggle()'), 'Must contain initPasswordToggle');
  assert(loginJs.includes("passwordInput.setAttribute('type'"), 'Must toggle type attribute between text and password');
});

// ----------------------------------------------------------------------------
// TEST GROUP 3: Authentication API Integration & Error Reporting (Isolated)
// ----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 3: Authentication API Integration & Error Handling (Isolated) ---');

const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const pool = require('../src/config/db');
const { createAuthRouter } = require('../src/routes/auth.routes');
const { createLoginLimiter } = require('../src/middleware/rateLimit.middleware');

async function runApiTests() {
  // Spin up an isolated Express test application with a dedicated in-memory limiter store
  // so automated test attempts NEVER consume or exhaust the running dev server's rate-limit quota.
  const testApp = express();
  testApp.use(express.json());
  testApp.use(cookieParser());

  const testLimiter = createLoginLimiter();
  testApp.use('/api/auth', createAuthRouter({ loginLimiter: testLimiter }));

  const testServer = http.createServer(testApp);
  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const testPort = testServer.address().port;
  const TEST_BASE_URL = `http://127.0.0.1:${testPort}`;

  try {
    // Test 3.1: Invalid credentials return HTTP 401 with generic safe message
    const resInvalid = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'non_existent_admin_test_user',
        password: 'IncorrectPassword123!'
      })
    });

    test('POST /api/auth/login returns 401 for invalid credentials', () => {
      assert.strictEqual(resInvalid.status, 401, 'Should return HTTP 401');
    });

    const dataInvalid = await resInvalid.json();
    test('401 response returns generic auth error message without leaking user existence', () => {
      assert.strictEqual(dataInvalid.error, 'Unauthorized');
      assert.strictEqual(dataInvalid.message, 'Invalid username, email, or password.');
    });

    // Test 3.2: Missing credentials return HTTP 400
    const resEmpty = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '', password: '' })
    });

    test('POST /api/auth/login returns 400 for empty credentials', () => {
      assert.strictEqual(resEmpty.status, 400, 'Should return HTTP 400');
    });
  } catch (err) {
    console.error(`  [FAIL] API test connection error: ${err.message}`);
    failed++;
  } finally {
    await new Promise((resolve) => testServer.close(resolve));
    await pool.end();
  }

  // ----------------------------------------------------------------------------
  // Summary
  // ----------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`Verification Summary: ${passed} Passed, ${failed} Failed`);
  console.log('============================================================');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runApiTests();

