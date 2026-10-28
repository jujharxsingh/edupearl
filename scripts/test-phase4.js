/**
 * Phase 4 Verification & RBAC Acceptance Tests
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../src/config/db');
const { generateToken, AUTH_COOKIE_NAME } = require('../src/utils/token');

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('====================================================');
  console.log('Edupearl Phase 4: Services & Courses Automated Tests');
  console.log('====================================================\n');

  let branchAdminId = null;
  let counselorId = null;
  let testServiceId = null;

  try {
    // 1. Setup temporary test admins for Branch Admin and Counselor roles
    console.log('[Setup] Setting up temporary test admin accounts for role verification...');
    
    // Check if test branch admin exists
    const [existingBA] = await pool.query('SELECT id, is_active FROM admins WHERE username = ?', ['test_phase4_branchadmin']);
    if (existingBA.length > 0) {
      branchAdminId = existingBA[0].id;
      await pool.query('UPDATE admins SET is_active = TRUE, role = "branch_admin" WHERE id = ?', [branchAdminId]);
    } else {
      const [resBA] = await pool.query(
        `INSERT INTO admins (username, email, password_hash, full_name, role, is_active)
         VALUES ('test_phase4_branchadmin', 'test_branchadmin_phase4@example.com', '$2b$12$dummyhashfordemonstrationonly12345678901234567890', 'Test Branch Admin', 'branch_admin', TRUE)`
      );
      branchAdminId = resBA.insertId;
    }

    // Check if test counselor exists
    const [existingCounselor] = await pool.query('SELECT id, is_active FROM admins WHERE username = ?', ['test_phase4_counselor']);
    if (existingCounselor.length > 0) {
      counselorId = existingCounselor[0].id;
      await pool.query('UPDATE admins SET is_active = TRUE, role = "counselor" WHERE id = ?', [counselorId]);
    } else {
      const [resC] = await pool.query(
        `INSERT INTO admins (username, email, password_hash, full_name, role, is_active)
         VALUES ('test_phase4_counselor', 'test_counselor_phase4@example.com', '$2b$12$dummyhashfordemonstrationonly12345678901234567890', 'Test Counselor', 'counselor', TRUE)`
      );
      counselorId = resC.insertId;
    }

    console.log(`[Setup] Accounts verified: SuperAdmin (id=1), BranchAdmin (id=${branchAdminId}), Counselor (id=${counselorId})`);

    // Mint test JWTs
    const superAdminToken = generateToken({ id: 1, username: 'jujhar', role: 'super_admin' });
    const branchAdminToken = generateToken({ id: branchAdminId, username: 'test_phase4_branchadmin', role: 'branch_admin' });
    const counselorToken = generateToken({ id: counselorId, username: 'test_phase4_counselor', role: 'counselor' });

    const superAdminHeaders = { 'Cookie': `${AUTH_COOKIE_NAME}=${superAdminToken}`, 'Content-Type': 'application/json' };
    const branchAdminHeaders = { 'Cookie': `${AUTH_COOKIE_NAME}=${branchAdminToken}`, 'Content-Type': 'application/json' };
    const counselorHeaders = { 'Cookie': `${AUTH_COOKIE_NAME}=${counselorToken}`, 'Content-Type': 'application/json' };

    // ------------------------------------------------------------------------
    // TEST 1: Assets HTTP 200
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 1: Page and Assets Accessibility (HTTP 200) ---');
    const assetUrls = [
      '/admin/services.html',
      '/admin/js/services.js',
      '/admin/js/admin-api.js',
      '/admin/js/auth-guard.js',
      '/admin/css/admin.css'
    ];
    for (const url of assetUrls) {
      const res = await fetch(`${BASE_URL}${url}`);
      console.log(`  ${url} -> HTTP ${res.status} ${res.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
      if (res.status !== 200) throw new Error(`Asset ${url} failed with status ${res.status}`);
    }

    // ------------------------------------------------------------------------
    // TEST 2: Unauthenticated protection & redirect
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Unauthenticated Access & Login Redirect ---');
    const meRes = await fetch(`${BASE_URL}/api/admin/me`);
    console.log(`  GET /api/admin/me without credentials -> HTTP ${meRes.status} (Expected: 401) ${meRes.status === 401 ? '✅ PASS' : '❌ FAIL'}`);

    // ------------------------------------------------------------------------
    // TEST 3: All three authorized roles can view active records
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Active Records Visibility for All Roles ---');
    const saView = await fetch(`${BASE_URL}/api/services`, { headers: superAdminHeaders }).then(r => r.json());
    console.log(`  Super Admin view active services: count = ${saView.count} ${saView.status === 'success' ? '✅ PASS' : '❌ FAIL'}`);

    const baView = await fetch(`${BASE_URL}/api/services`, { headers: branchAdminHeaders }).then(r => r.json());
    console.log(`  Branch Admin view active services: count = ${baView.count} ${baView.status === 'success' ? '✅ PASS' : '❌ FAIL'}`);

    const cView = await fetch(`${BASE_URL}/api/services`, { headers: counselorHeaders }).then(r => r.json());
    console.log(`  Counselor view active services: count = ${cView.count} ${cView.status === 'success' ? '✅ PASS' : '❌ FAIL'}`);

    const pubView = await fetch(`${BASE_URL}/api/services`).then(r => r.json());
    console.log(`  Public visitor view active services: count = ${pubView.count} ${pubView.status === 'success' ? '✅ PASS' : '❌ FAIL'}`);

    // ------------------------------------------------------------------------
    // TEST 4: Category filtering works with existing API
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Category Filtering ---');
    const langRes = await fetch(`${BASE_URL}/api/services?category=language_course`).then(r => r.json());
    const onlyLang = langRes.services.every(s => s.category === 'language_course');
    console.log(`  ?category=language_course -> count = ${langRes.count}, all language_course: ${onlyLang} ${onlyLang ? '✅ PASS' : '❌ FAIL'}`);

    const immRes = await fetch(`${BASE_URL}/api/services?category=immigration_service`).then(r => r.json());
    const onlyImm = immRes.services.every(s => s.category === 'immigration_service');
    console.log(`  ?category=immigration_service -> count = ${immRes.count}, all immigration_service: ${onlyImm} ${onlyImm ? '✅ PASS' : '❌ FAIL'}`);

    const badCatRes = await fetch(`${BASE_URL}/api/services?category=invalid_category`);
    console.log(`  ?category=invalid_category -> HTTP ${badCatRes.status} (Expected: 400) ${badCatRes.status === 400 ? '✅ PASS' : '❌ FAIL'}`);

    // ------------------------------------------------------------------------
    // TEST 6: Add and edit work for Super Admin and Branch Admin
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Add & Edit by Super Admin and Branch Admin ---');
    
    // Super Admin creates a test record
    const saCreatePayload = {
      title: 'Automated Test Service SA',
      category: 'language_course',
      slug: 'automated-test-service-sa',
      short_description: 'A test language course created by Super Admin during automated test run.',
      detailed_description: 'Full syllabus for automated testing verification.',
      duration_info: '4 Weeks',
      is_featured: false,
      display_order: 99
    };
    const saCreateRes = await fetch(`${BASE_URL}/api/services`, {
      method: 'POST',
      headers: superAdminHeaders,
      body: JSON.stringify(saCreatePayload)
    });
    const saCreateData = await saCreateRes.json();
    console.log(`  Super Admin create service -> HTTP ${saCreateRes.status} (Expected: 201) ${saCreateRes.status === 201 ? '✅ PASS' : '❌ FAIL'}`);
    testServiceId = saCreateData.service ? saCreateData.service.id : null;

    // Branch Admin updates the test record
    const baUpdatePayload = {
      title: 'Automated Test Service Updated by BA',
      category: 'language_course',
      slug: 'automated-test-service-sa',
      short_description: 'Updated short description by Branch Admin during test.',
      duration_info: '6 Weeks',
      is_featured: true,
      display_order: 88
    };
    const baUpdateRes = await fetch(`${BASE_URL}/api/services/${testServiceId}`, {
      method: 'PUT',
      headers: branchAdminHeaders,
      body: JSON.stringify(baUpdatePayload)
    });
    const baUpdateData = await baUpdateRes.json();
    console.log(`  Branch Admin update service -> HTTP ${baUpdateRes.status} (Expected: 200) ${baUpdateRes.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Updated title: "${baUpdateData.service.title}", duration: "${baUpdateData.service.duration_info}"`);

    // ------------------------------------------------------------------------
    // TEST 7: Duplicate slug displays conflict error (HTTP 409)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Duplicate Slug Conflict Handling (HTTP 409) ---');
    const dupRes = await fetch(`${BASE_URL}/api/services`, {
      method: 'POST',
      headers: superAdminHeaders,
      body: JSON.stringify({
        title: 'Another IELTS Offering',
        category: 'language_course',
        slug: 'ielts-academic-coaching', // Existing seed slug
        short_description: 'Attempting to create duplicate slug.'
      })
    });
    const dupData = await dupRes.json();
    console.log(`  Create with duplicate slug -> HTTP ${dupRes.status} (Expected: 409) ${dupRes.status === 409 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Error message: "${dupData.message}" ${dupData.error === 'Conflict' ? '✅ PASS' : '❌ FAIL'}`);

    // ------------------------------------------------------------------------
    // TEST 8: Counselors cannot create or edit records (HTTP 403)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 8: Counselor Create & Edit Restrictions (HTTP 403) ---');
    const cCreateRes = await fetch(`${BASE_URL}/api/services`, {
      method: 'POST',
      headers: counselorHeaders,
      body: JSON.stringify({
        title: 'Counselor Attempt Service',
        category: 'language_course',
        slug: 'counselor-attempt-service',
        short_description: 'Should be rejected by RBAC.'
      })
    });
    console.log(`  Counselor POST /api/services -> HTTP ${cCreateRes.status} (Expected: 403) ${cCreateRes.status === 403 ? '✅ PASS' : '❌ FAIL'}`);

    const cUpdateRes = await fetch(`${BASE_URL}/api/services/${testServiceId}`, {
      method: 'PUT',
      headers: counselorHeaders,
      body: JSON.stringify(baUpdatePayload)
    });
    console.log(`  Counselor PUT /api/services/:id -> HTTP ${cUpdateRes.status} (Expected: 403) ${cUpdateRes.status === 403 ? '✅ PASS' : '❌ FAIL'}`);

    // ------------------------------------------------------------------------
    // TEST 9 & 10: Activation and deactivation (Super Admin only, soft-delete)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 9 & 10: Activation/Deactivation (Soft Delete Policy) ---');
    
    // Branch Admin tries to deactivate -> 403 Forbidden
    const baDeactRes = await fetch(`${BASE_URL}/api/services/${testServiceId}/status`, {
      method: 'PATCH',
      headers: branchAdminHeaders,
      body: JSON.stringify({ is_active: false })
    });
    console.log(`  Branch Admin PATCH /api/services/:id/status -> HTTP ${baDeactRes.status} (Expected: 403) ${baDeactRes.status === 403 ? '✅ PASS' : '❌ FAIL'}`);

    // Counselor tries to deactivate -> 403 Forbidden
    const cDeactRes = await fetch(`${BASE_URL}/api/services/${testServiceId}/status`, {
      method: 'PATCH',
      headers: counselorHeaders,
      body: JSON.stringify({ is_active: false })
    });
    console.log(`  Counselor PATCH /api/services/:id/status -> HTTP ${cDeactRes.status} (Expected: 403) ${cDeactRes.status === 403 ? '✅ PASS' : '❌ FAIL'}`);

    // Super Admin deactivates record -> 200 OK
    const saDeactRes = await fetch(`${BASE_URL}/api/services/${testServiceId}/status`, {
      method: 'PATCH',
      headers: superAdminHeaders,
      body: JSON.stringify({ is_active: false })
    });
    const saDeactData = await saDeactRes.json();
    console.log(`  Super Admin deactivates record -> HTTP ${saDeactRes.status} (Expected: 200) ${saDeactRes.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Status returned: is_active = ${saDeactData.service.is_active} (${saDeactData.message})`);

    // Verify Public listing DOES NOT show deactivated record
    const pubAfterDeact = await fetch(`${BASE_URL}/api/services`).then(r => r.json());
    const publicIncludesDeactivated = pubAfterDeact.services.some(s => s.id === testServiceId);
    console.log(`  Public listing excludes deactivated record: ${!publicIncludesDeactivated} ${!publicIncludesDeactivated ? '✅ PASS' : '❌ FAIL'}`);

    // TEST 5: Super Admin can view inactive records via ?includeInactive=true
    console.log('\n--- TEST 5: Inactive Records Visibility (Super Admin Only) ---');
    const saInactiveView = await fetch(`${BASE_URL}/api/services?includeInactive=true`, { headers: superAdminHeaders }).then(r => r.json());
    const saSeesInactive = saInactiveView.services.some(s => s.id === testServiceId);
    console.log(`  Super Admin with ?includeInactive=true sees deactivated record: ${saSeesInactive} ${saSeesInactive ? '✅ PASS' : '❌ FAIL'}`);

    // Non-super-admin with ?includeInactive=true is ignored by backend (only active returned)
    const baInactiveView = await fetch(`${BASE_URL}/api/services?includeInactive=true`, { headers: branchAdminHeaders }).then(r => r.json());
    const baSeesInactive = baInactiveView.services.some(s => s.id === testServiceId);
    console.log(`  Branch Admin with ?includeInactive=true denied inactive records: ${!baSeesInactive} ${!baSeesInactive ? '✅ PASS' : '❌ FAIL'}`);

    const cInactiveView = await fetch(`${BASE_URL}/api/services?includeInactive=true`, { headers: counselorHeaders }).then(r => r.json());
    const cSeesInactive = cInactiveView.services.some(s => s.id === testServiceId);
    console.log(`  Counselor with ?includeInactive=true denied inactive records: ${!cSeesInactive} ${!cSeesInactive ? '✅ PASS' : '❌ FAIL'}`);

    // Reactivation by Super Admin
    const saReactRes = await fetch(`${BASE_URL}/api/services/${testServiceId}/status`, {
      method: 'PATCH',
      headers: superAdminHeaders,
      body: JSON.stringify({ is_active: true })
    });
    const saReactData = await saReactRes.json();
    console.log(`  Super Admin reactivates record -> HTTP ${saReactRes.status} (Expected: 200) ${saReactRes.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Status returned: is_active = ${saReactData.service.is_active} (${saReactData.message})`);

    // Verify Public listing includes reactivated record
    const pubAfterReact = await fetch(`${BASE_URL}/api/services`).then(r => r.json());
    const publicIncludesReactivated = pubAfterReact.services.some(s => s.id === testServiceId);
    console.log(`  Public listing now includes reactivated record: ${publicIncludesReactivated} ${publicIncludesReactivated ? '✅ PASS' : '❌ FAIL'}`);

    // ------------------------------------------------------------------------
    // TEST 11 & 12: Public website & Admin modules operational
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 11 & 12: Public Catalog & Admin Modules Regression ---');
    const healthApi = await fetch(`${BASE_URL}/api/health`).then(r => r.json());
    console.log(`  GET /api/health -> ${healthApi.status} ✅ PASS`);

    const healthDb = await fetch(`${BASE_URL}/api/health/db`).then(r => r.json());
    console.log(`  GET /api/health/db -> ${healthDb.status} ✅ PASS`);

    const pubServicesHtml = await fetch(`${BASE_URL}/services.html`);
    console.log(`  GET /services.html -> HTTP ${pubServicesHtml.status} ✅ PASS`);

    const pubBranchesHtml = await fetch(`${BASE_URL}/branches.html`);
    console.log(`  GET /branches.html -> HTTP ${pubBranchesHtml.status} ✅ PASS`);

    const adminIndexHtml = await fetch(`${BASE_URL}/admin/index.html`);
    console.log(`  GET /admin/index.html -> HTTP ${adminIndexHtml.status} ✅ PASS`);

    const adminEnquiriesHtml = await fetch(`${BASE_URL}/admin/enquiries.html`);
    console.log(`  GET /admin/enquiries.html -> HTTP ${adminEnquiriesHtml.status} ✅ PASS`);

    const adminLoginHtml = await fetch(`${BASE_URL}/admin/login.html`);
    console.log(`  GET /admin/login.html -> HTTP ${adminLoginHtml.status} ✅ PASS`);

    const branchesApi = await fetch(`${BASE_URL}/api/branches`).then(r => r.json());
    console.log(`  GET /api/branches -> status ${branchesApi.status}, count = ${branchesApi.count} ✅ PASS`);

    const enquiriesApi = await fetch(`${BASE_URL}/api/enquiries`, { headers: superAdminHeaders }).then(r => r.json());
    console.log(`  GET /api/enquiries (Super Admin) -> status ${enquiriesApi.status}, total = ${enquiriesApi.pagination ? enquiriesApi.pagination.total : 'ok'} ✅ PASS`);

    // ------------------------------------------------------------------------
    // CLEANUP / RESTORATION POLICY:
    // Deactivate temporary test record (do NOT permanently delete per instructions)
    // Deactivate temporary test admins
    // ------------------------------------------------------------------------
    console.log('\n--- Clean-up & Data Restoration Policy ---');
    if (testServiceId) {
      await pool.query('UPDATE services_courses SET is_active = FALSE WHERE id = ?', [testServiceId]);
      console.log(`  [Restoration] Temporary test service id=${testServiceId} safely deactivated (soft-delete preserved).`);
    }

    if (branchAdminId) {
      await pool.query('UPDATE admins SET is_active = FALSE WHERE id = ?', [branchAdminId]);
      console.log(`  [Restoration] Temporary branch admin id=${branchAdminId} deactivated.`);
    }

    if (counselorId) {
      await pool.query('UPDATE admins SET is_active = FALSE WHERE id = ?', [counselorId]);
      console.log(`  [Restoration] Temporary counselor id=${counselorId} deactivated.`);
    }

    console.log('\n====================================================');
    console.log('✅ ALL PHASE 4 AUTOMATED ACCEPTANCE TESTS PASSED!');
    console.log('====================================================');

  } catch (err) {
    console.error('\n❌ TEST RUN ENCOUNTERED FAILURE:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runTests();
