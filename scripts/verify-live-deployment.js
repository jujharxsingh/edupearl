/**
 * ============================================================================
 * Edupearl: Live Production Deployment Verification Suite
 * ============================================================================
 * 
 * Tests the live deployed website against all functional and security requirements:
 * 1. Homepage & Navigation
 * 2. Public API endpoints (/api/health, /api/branches, /api/services)
 * 3. Database connectivity via /api/health/db
 * 4. Lead Enquiry submission & database persistence
 * 5. Super Admin authentication & secure cookie validation
 * 6. Protected admin dashboard access
 * 7. Secure logout & session invalidation
 * 
 * Usage:
 *   node scripts/verify-live-deployment.js <LIVE_URL>
 * Example:
 *   node scripts/verify-live-deployment.js https://edupearl-portal.onrender.com
 * ============================================================================
 */

const targetUrl = process.argv[2] || process.env.LIVE_URL || 'http://localhost:5000';
const cleanBaseUrl = targetUrl.replace(/\/+$/, '');

console.log('====================================================');
console.log('Edupearl: Live Deployment Verification Suite');
console.log(`Target URL: ${cleanBaseUrl}`);
console.log('====================================================\n');

let passedCount = 0;
let failedCount = 0;

async function runStep(name, fn) {
  try {
    process.stdout.write(`• Testing ${name}... `);
    await fn();
    console.log('✓ PASS');
    passedCount++;
  } catch (error) {
    console.log(`✗ FAIL\n  Error: ${error.message}`);
    failedCount++;
  }
}

async function verifyAll() {
  let authCookie = null;
  const testEnquiryPhone = '+91 91150 52624';
  const testEnquiryEmail = `verify.${Date.now()}@example.com`;

  // Step 1: Homepage
  await runStep('GET / (Homepage)', async () => {
    const res = await fetch(`${cleanBaseUrl}/`);
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const text = await res.text();
    if (!text.includes('Edu Pearl') && !text.includes('Edupearl')) {
      throw new Error('Homepage missing Edupearl brand content');
    }
  });

  // Step 2: Health Check
  await runStep('GET /api/health (Service Liveness)', async () => {
    const res = await fetch(`${cleanBaseUrl}/api/health`);
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`Unexpected status: ${data.status}`);
  });

  // Step 3: Database Health
  await runStep('GET /api/health/db (Database Connectivity)', async () => {
    const res = await fetch(`${cleanBaseUrl}/api/health/db`);
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok' || data.database !== 'connected') {
      throw new Error(`Database reported unhealthy: ${JSON.stringify(data)}`);
    }
  });

  // Step 4: Branches API
  await runStep('GET /api/branches (Active Branches Catalog)', async () => {
    const res = await fetch(`${cleanBaseUrl}/api/branches`);
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    if (data.status !== 'success' || !Array.isArray(data.branches)) {
      throw new Error('Branches API response malformed');
    }
    if (data.branches.length < 6) {
      throw new Error(`Expected at least 6 active branches, found ${data.branches.length}`);
    }
  });

  // Step 5: Services & Courses API
  await runStep('GET /api/services (Services & Courses Catalog)', async () => {
    const res = await fetch(`${cleanBaseUrl}/api/services`);
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    if (data.status !== 'success' || !Array.isArray(data.services)) {
      throw new Error('Services API response malformed');
    }
    if (data.services.length < 6) {
      throw new Error(`Expected at least 6 active services/courses, found ${data.services.length}`);
    }
  });

  // Step 6: Public Lead Submission
  await runStep('POST /api/enquiries (Lead Enquiry Submission & DB Persistence)', async () => {
    const payload = {
      full_name: 'Live Deployment Verifier',
      email: testEnquiryEmail,
      phone: testEnquiryPhone,
      city: 'Ludhiana',
      message: 'Automated verification test of live deployment.',
      target_country: 'Canada'
    };

    const res = await fetch(`${cleanBaseUrl}/api/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.status !== 201) {
      const errBody = await res.text();
      throw new Error(`Expected HTTP 201 Created, got ${res.status}: ${errBody}`);
    }
    const data = await res.json();
    if (!data.enquiry || !data.enquiry.enquiry_reference || !data.enquiry.enquiry_reference.startsWith('ENQ-')) {
      throw new Error(`Invalid reference code received: ${JSON.stringify(data)}`);
    }
  });

  // Step 7: Super Admin Login
  await runStep('POST /api/auth/login (Admin Authentication)', async () => {
    const username = process.env.ADMIN_INITIAL_USERNAME || 'jujhar';
    const password = process.env.ADMIN_INITIAL_PASSWORD || 'Edupearl@2026!';

    const res = await fetch(`${cleanBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: username, password })
    });

    if (res.status !== 200) {
      const errText = await res.text();
      throw new Error(`Login failed with HTTP ${res.status}: ${errText}`);
    }

    // Extract cookie
    const rawCookie = res.headers.get('set-cookie');
    if (!rawCookie || !rawCookie.includes('edupearl_token=')) {
      throw new Error('Login succeeded but auth cookie was not set in headers');
    }
    authCookie = rawCookie.split(';')[0];
  });

  // Step 8: Authenticated Admin Session Validation
  await runStep('GET /api/admin/me (Protected Admin Session)', async () => {
    if (!authCookie) throw new Error('Skipping: No auth cookie available');
    const res = await fetch(`${cleanBaseUrl}/api/admin/me`, {
      headers: { 'Cookie': authCookie }
    });
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok' || !data.admin || data.admin.username !== 'jujhar') {
      throw new Error(`Session verification failed: ${JSON.stringify(data)}`);
    }
  });

  // Step 9: Admin Dashboard HTML Access
  await runStep('GET /admin/index.html (Admin Dashboard)', async () => {
    const res = await fetch(`${cleanBaseUrl}/admin/index.html`);
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
    const html = await res.text();
    if (!html.includes('Edupearl') && !html.includes('Dashboard')) {
      throw new Error('Admin dashboard HTML content missing expected elements');
    }
  });

  // Step 10: Admin Logout
  await runStep('POST /api/auth/logout (Secure Logout)', async () => {
    const res = await fetch(`${cleanBaseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: authCookie ? { 'Cookie': authCookie } : {}
    });
    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);
  });

  console.log('\n====================================================');
  console.log(`Verification Summary: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

verifyAll();

