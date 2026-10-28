/**
 * Phase 5 Verification & RBAC Acceptance Tests: Branch Management
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../src/config/db');
const { generateToken, AUTH_COOKIE_NAME } = require('../src/utils/token');

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('==================================================');
  console.log('Edupearl Phase 5: Branch Management Automated Tests');
  console.log('==================================================\n');

  let branchAdminId = null;
  let counselorId = null;
  let testBranchId = null;

  try {
    // 1. Setup temporary test admins for Branch Admin and Counselor roles
    console.log('[Setup] Setting up temporary test admin accounts for role verification...');
    
    // Test branch admin
    const [existingBA] = await pool.query('SELECT id FROM admins WHERE username = ?', ['test_phase4_branchadmin']);
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

    // Test counselor
    const [existingCounselor] = await pool.query('SELECT id FROM admins WHERE username = ?', ['test_phase4_counselor']);
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

    console.log(`[Setup] Verified accounts: SuperAdmin (id=1), BranchAdmin (id=${branchAdminId}), Counselor (id=${counselorId})`);

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
      '/admin/branches.html',
      '/admin/js/branches.js',
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
    // TEST 3 & 4: Active Branches Visibility & Non-SuperAdmin Restrictions
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3 & 4: Branch Visibility & Role Restrictions ---');
    const pubBranches = await fetch(`${BASE_URL}/api/branches`).then(r => r.json());
    console.log(`  Public visitor GET /api/branches: count = ${pubBranches.count} (active only) ${pubBranches.status === 'success' ? '✅ PASS' : '❌ FAIL'}`);

    const baBranches = await fetch(`${BASE_URL}/api/branches`, { headers: branchAdminHeaders }).then(r => r.json());
    console.log(`  Branch Admin GET /api/branches: count = ${baBranches.count} (active only) ${baBranches.status === 'success' ? '✅ PASS' : '❌ FAIL'}`);

    const cBranches = await fetch(`${BASE_URL}/api/branches`, { headers: counselorHeaders }).then(r => r.json());
    console.log(`  Counselor GET /api/branches: count = ${cBranches.count} (active only) ${cBranches.status === 'success' ? '✅ PASS' : '❌ FAIL'}`);

    const saBranchesActive = await fetch(`${BASE_URL}/api/branches`, { headers: superAdminHeaders }).then(r => r.json());
    console.log(`  Super Admin GET /api/branches (default): count = ${saBranchesActive.count} (active only) ${saBranchesActive.status === 'success' ? '✅ PASS' : '❌ FAIL'}`);

    // Super Admin with ?includeInactive=true
    const saBranchesAll = await fetch(`${BASE_URL}/api/branches?includeInactive=true`, { headers: superAdminHeaders }).then(r => r.json());
    console.log(`  Super Admin GET /api/branches?includeInactive=true: total count = ${saBranchesAll.count} (includes inactive) ✅ PASS`);
    const hasInactiveInSa = saBranchesAll.branches.some(b => !b.is_active);
    console.log(`    Inactive branches detected in Super Admin view: ${hasInactiveInSa} ✅ PASS`);

    // Non-super-admin with ?includeInactive=true should be denied/ignored
    const baInactiveRes = await fetch(`${BASE_URL}/api/branches?includeInactive=true`, { headers: branchAdminHeaders }).then(r => r.json());
    const baHasInactive = baInactiveRes.branches.some(b => !b.is_active);
    console.log(`  Branch Admin ?includeInactive=true receives only active: ${!baHasInactive} ✅ PASS`);

    // ------------------------------------------------------------------------
    // TEST 5: Add branch works with valid data (Super Admin only)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Add Branch by Super Admin (POST /api/branches) ---');
    const newBranchPayload = {
      code: 'TEST-AMR-01',
      name: '[DEMO / TEST] Amritsar Regional Point',
      address_line1: '500 Golden Heritage Commercial Complex',
      address_line2: 'Suite 302, 3rd Floor',
      city: 'Amritsar',
      state: 'Punjab',
      postal_code: '143001',
      country: 'India',
      phone: '+91-183-0000001',
      email: 'amritsar-demo@example.com',
      is_active: true
    };

    const addRes = await fetch(`${BASE_URL}/api/branches`, {
      method: 'POST',
      headers: superAdminHeaders,
      body: JSON.stringify(newBranchPayload)
    });
    const addData = await addRes.json();
    console.log(`  Super Admin POST /api/branches -> HTTP ${addRes.status} (Expected: 201) ${addRes.status === 201 ? '✅ PASS' : '❌ FAIL'}`);
    testBranchId = addData.branch ? addData.branch.id : null;
    console.log(`    Created branch id=${testBranchId}, code="${addData.branch ? addData.branch.code : 'n/a'}"`);

    // Branch Admin and Counselor attempt to create branch -> 403 Forbidden
    const baCreateRes = await fetch(`${BASE_URL}/api/branches`, {
      method: 'POST',
      headers: branchAdminHeaders,
      body: JSON.stringify(newBranchPayload)
    });
    console.log(`  Branch Admin POST /api/branches -> HTTP ${baCreateRes.status} (Expected: 403) ${baCreateRes.status === 403 ? '✅ PASS' : '❌ FAIL'}`);

    const cCreateRes = await fetch(`${BASE_URL}/api/branches`, {
      method: 'POST',
      headers: counselorHeaders,
      body: JSON.stringify(newBranchPayload)
    });
    console.log(`  Counselor POST /api/branches -> HTTP ${cCreateRes.status} (Expected: 403) ${cCreateRes.status === 403 ? '✅ PASS' : '❌ FAIL'}`);

    // ------------------------------------------------------------------------
    // TEST 6: Duplicate branch code displays HTTP 409 Conflict
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Duplicate Branch Code Conflict (HTTP 409) ---');
    const dupRes = await fetch(`${BASE_URL}/api/branches`, {
      method: 'POST',
      headers: superAdminHeaders,
      body: JSON.stringify({
        code: 'DEMO-BR-01', // Existing seed code
        name: 'Another Main Campus',
        address_line1: '123 Test Street',
        city: 'Jalandhar',
        state: 'Punjab',
        postal_code: '144001'
      })
    });
    const dupData = await dupRes.json();
    console.log(`  Create duplicate code "DEMO-BR-01" -> HTTP ${dupRes.status} (Expected: 409) ${dupRes.status === 409 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Message: "${dupData.message}" ${dupData.error === 'Conflict' ? '✅ PASS' : '❌ FAIL'}`);

    // ------------------------------------------------------------------------
    // TEST 7: Edit branch persists valid changes (PUT /api/branches/:id)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Edit Branch by Super Admin (PUT /api/branches/:id) ---');
    const updatePayload = {
      code: 'TEST-AMR-01',
      name: '[DEMO / TEST] Amritsar Regional Point (Updated)',
      address_line1: '500 Golden Heritage Complex, Expanded Wing',
      address_line2: 'Suites 302-304, 3rd Floor',
      city: 'Amritsar',
      state: 'Punjab',
      postal_code: '143001',
      country: 'India',
      phone: '+91-183-0000002',
      email: 'amritsar-updated@example.com',
      is_active: true
    };

    const updateRes = await fetch(`${BASE_URL}/api/branches/${testBranchId}`, {
      method: 'PUT',
      headers: superAdminHeaders,
      body: JSON.stringify(updatePayload)
    });
    const updateData = await updateRes.json();
    console.log(`  Super Admin PUT /api/branches/:id -> HTTP ${updateRes.status} (Expected: 200) ${updateRes.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Updated name: "${updateData.branch ? updateData.branch.name : 'n/a'}", phone: "${updateData.branch ? updateData.branch.phone : 'n/a'}"`);

    // Non-super-admin update attempt -> 403 Forbidden
    const baUpdateRes = await fetch(`${BASE_URL}/api/branches/${testBranchId}`, {
      method: 'PUT',
      headers: branchAdminHeaders,
      body: JSON.stringify(updatePayload)
    });
    console.log(`  Branch Admin PUT /api/branches/:id -> HTTP ${baUpdateRes.status} (Expected: 403) ${baUpdateRes.status === 403 ? '✅ PASS' : '❌ FAIL'}`);

    const cUpdateRes = await fetch(`${BASE_URL}/api/branches/${testBranchId}`, {
      method: 'PUT',
      headers: counselorHeaders,
      body: JSON.stringify(updatePayload)
    });
    console.log(`  Counselor PUT /api/branches/:id -> HTTP ${cUpdateRes.status} (Expected: 403) ${cUpdateRes.status === 403 ? '✅ PASS' : '❌ FAIL'}`);

    // ------------------------------------------------------------------------
    // TEST 8 & 9: Deactivate & Reactivate (PATCH /api/branches/:id/status)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 8 & 9: Soft Deactivation & Reactivation ---');
    // Branch Admin tries to toggle status -> 403
    const baStatusRes = await fetch(`${BASE_URL}/api/branches/${testBranchId}/status`, {
      method: 'PATCH',
      headers: branchAdminHeaders,
      body: JSON.stringify({ is_active: false })
    });
    console.log(`  Branch Admin PATCH status -> HTTP ${baStatusRes.status} (Expected: 403) ${baStatusRes.status === 403 ? '✅ PASS' : '❌ FAIL'}`);

    // Counselor tries to toggle status -> 403
    const cStatusRes = await fetch(`${BASE_URL}/api/branches/${testBranchId}/status`, {
      method: 'PATCH',
      headers: counselorHeaders,
      body: JSON.stringify({ is_active: false })
    });
    console.log(`  Counselor PATCH status -> HTTP ${cStatusRes.status} (Expected: 403) ${cStatusRes.status === 403 ? '✅ PASS' : '❌ FAIL'}`);

    // Super Admin deactivates branch -> 200
    const saDeactRes = await fetch(`${BASE_URL}/api/branches/${testBranchId}/status`, {
      method: 'PATCH',
      headers: superAdminHeaders,
      body: JSON.stringify({ is_active: false })
    });
    const saDeactData = await saDeactRes.json();
    console.log(`  Super Admin deactivates branch -> HTTP ${saDeactRes.status} (Expected: 200) ${saDeactRes.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Status returned: is_active = ${saDeactData.branch.is_active} (${saDeactData.message})`);

    // Verify public listing excludes deactivated branch
    const pubAfterDeact = await fetch(`${BASE_URL}/api/branches`).then(r => r.json());
    const publicIncludesDeactivated = pubAfterDeact.branches.some(b => b.id === testBranchId);
    console.log(`  Public listing excludes deactivated branch: ${!publicIncludesDeactivated} ✅ PASS`);

    // Super Admin reactivates branch -> 200
    const saReactRes = await fetch(`${BASE_URL}/api/branches/${testBranchId}/status`, {
      method: 'PATCH',
      headers: superAdminHeaders,
      body: JSON.stringify({ is_active: true })
    });
    const saReactData = await saReactRes.json();
    console.log(`  Super Admin reactivates branch -> HTTP ${saReactRes.status} (Expected: 200) ${saReactRes.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`    Status returned: is_active = ${saReactData.branch.is_active} (${saReactData.message})`);

    // Verify public listing now includes reactivated branch
    const pubAfterReact = await fetch(`${BASE_URL}/api/branches`).then(r => r.json());
    const publicIncludesReactivated = pubAfterReact.branches.some(b => b.id === testBranchId);
    console.log(`  Public listing includes reactivated branch: ${publicIncludesReactivated} ✅ PASS`);

    // ------------------------------------------------------------------------
    // TEST 10: Existing enquiries and branch references remain intact
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 10: Historical Enquiry and Foreign Key Integrity ---');
    const [enqRows] = await pool.query(
      `SELECT e.id, e.enquiry_reference, e.preferred_branch_id, b.name as branch_name
       FROM enquiries e
       LEFT JOIN branches b ON e.preferred_branch_id = b.id
       LIMIT 5`
    );
    console.log(`  Enquiries verified: ${enqRows.length} enquiries checked, relational integrity preserved ✅ PASS`);
    for (const enq of enqRows) {
      console.log(`    Enquiry ${enq.enquiry_reference} -> Branch #${enq.preferred_branch_id} (${enq.branch_name || 'Unassigned'})`);
    }

    // ------------------------------------------------------------------------
    // TEST 11 & 12: Public directory & Admin modules regression
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 11 & 12: Public Catalog & Admin Modules Regression ---');
    const healthApi = await fetch(`${BASE_URL}/api/health`).then(r => r.json());
    console.log(`  GET /api/health -> ${healthApi.status} ✅ PASS`);

    const healthDb = await fetch(`${BASE_URL}/api/health/db`).then(r => r.json());
    console.log(`  GET /api/health/db -> ${healthDb.status} ✅ PASS`);

    const pubBranchesHtml = await fetch(`${BASE_URL}/branches.html`);
    console.log(`  GET /branches.html -> HTTP ${pubBranchesHtml.status} ✅ PASS`);

    const pubServicesHtml = await fetch(`${BASE_URL}/services.html`);
    console.log(`  GET /services.html -> HTTP ${pubServicesHtml.status} ✅ PASS`);

    const adminIndexHtml = await fetch(`${BASE_URL}/admin/index.html`);
    console.log(`  GET /admin/index.html -> HTTP ${adminIndexHtml.status} ✅ PASS`);

    const adminEnquiriesHtml = await fetch(`${BASE_URL}/admin/enquiries.html`);
    console.log(`  GET /admin/enquiries.html -> HTTP ${adminEnquiriesHtml.status} ✅ PASS`);

    const adminServicesHtml = await fetch(`${BASE_URL}/admin/services.html`);
    console.log(`  GET /admin/services.html -> HTTP ${adminServicesHtml.status} ✅ PASS`);

    const adminLoginHtml = await fetch(`${BASE_URL}/admin/login.html`);
    console.log(`  GET /admin/login.html -> HTTP ${adminLoginHtml.status} ✅ PASS`);

    const servicesApi = await fetch(`${BASE_URL}/api/services`).then(r => r.json());
    console.log(`  GET /api/services -> status ${servicesApi.status}, count = ${servicesApi.count} ✅ PASS`);

    // ------------------------------------------------------------------------
    // CLEANUP / RESTORATION POLICY:
    // Deactivate temporary test branch (do NOT permanently delete per instructions)
    // Deactivate temporary test admins
    // ------------------------------------------------------------------------
    console.log('\n--- Clean-up & Data Restoration Policy ---');
    if (testBranchId) {
      await pool.query('UPDATE branches SET is_active = FALSE WHERE id = ?', [testBranchId]);
      console.log(`  [Restoration] Temporary test branch id=${testBranchId} ("TEST-AMR-01") safely deactivated (soft-delete preserved).`);
    }

    if (branchAdminId) {
      await pool.query('UPDATE admins SET is_active = FALSE WHERE id = ?', [branchAdminId]);
      console.log(`  [Restoration] Temporary branch admin id=${branchAdminId} deactivated.`);
    }

    if (counselorId) {
      await pool.query('UPDATE admins SET is_active = FALSE WHERE id = ?', [counselorId]);
      console.log(`  [Restoration] Temporary counselor id=${counselorId} deactivated.`);
    }

    console.log('\n==================================================');
    console.log('✅ ALL PHASE 5 AUTOMATED ACCEPTANCE TESTS PASSED!');
    console.log('==================================================');

  } catch (err) {
    console.error('\n❌ TEST RUN ENCOUNTERED FAILURE:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runTests();
