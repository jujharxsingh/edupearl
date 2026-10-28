/**
 * ============================================================================
 * Edupearl Branch Selection Automated Verification Tests
 * ============================================================================
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('============================================================');
  console.log('Edupearl: Initial Branch Selection Automated Verification');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Accessibility of branch selection pages and routes
    console.log('--- TEST 1: Accessibility of Branch Selection Routes (HTTP 200) ---');
    const resSelectHtml = await fetch(`${BASE_URL}/select-branch.html`);
    assert(resSelectHtml.status === 200, 'GET /select-branch.html returns 200 OK');
    const htmlSelect = await resSelectHtml.text();
    assert(htmlSelect.includes('Select Your Preferred Training Center'), 'select-branch.html contains selection title');
    assert(htmlSelect.includes('id="branches-selection-container"'), 'select-branch.html contains dynamic container');
    assert(htmlSelect.includes('src="/js/select-branch.js"'), 'select-branch.html references select-branch.js');

    const resSelectAlias = await fetch(`${BASE_URL}/select-branch`);
    assert(resSelectAlias.status === 200, 'GET /select-branch route alias returns 200 OK');

    const resSelectJs = await fetch(`${BASE_URL}/js/select-branch.js`);
    assert(resSelectJs.status === 200, 'GET /js/select-branch.js returns 200 OK');

    // 2. Public API endpoint GET /api/branches returns active branches only
    console.log('\n--- TEST 2: Dynamic Branches Public API Verification ---');
    const resApiBranches = await fetch(`${BASE_URL}/api/branches`);
    assert(resApiBranches.status === 200, 'GET /api/branches returns 200 OK');
    const apiData = await resApiBranches.json();
    assert(apiData.status === 'success', 'API response status is success');
    assert(Array.isArray(apiData.branches) && apiData.branches.length > 0, `Returned ${apiData.branches ? apiData.branches.length : 0} active branches`);

    // Verify all returned branches are active and have expected fields
    const allActive = apiData.branches.every(b => b.is_active === 1 || b.is_active === true);
    assert(allActive, 'All returned branches have is_active = true / 1 (no inactive branches leaked)');

    const hasRequiredFields = apiData.branches.every(b => b.id && b.code && b.name && b.city && b.address_line1);
    assert(hasRequiredFields, 'All branches include required id, code, name, city, and address_line1');

    // 3. Verify no hardcoded branch names or IDs in frontend client files
    console.log('\n--- TEST 3: Verify No Hardcoded Branches in Frontend ---');
    const selectBranchJsContent = fs.readFileSync(path.resolve(__dirname, '../public/js/select-branch.js'), 'utf8');
    const selectBranchHtmlContent = fs.readFileSync(path.resolve(__dirname, '../public/select-branch.html'), 'utf8');

    const knownBranchNames = ['Ludhiana', 'Jagraon', 'Hathur', 'Sri Ganganagar', 'Kapurthala', 'Mullanpur Dakha'];
    // In HTML, make sure known locations are not hardcoded as branch cards in the dynamic container
    const containerSnippet = selectBranchHtmlContent.substring(
      selectBranchHtmlContent.indexOf('id="branches-selection-container"'),
      selectBranchHtmlContent.indexOf('</section>')
    );
    const hasHardcodedInContainer = knownBranchNames.some(name => containerSnippet.includes(`<h3>${name}`) || containerSnippet.includes(`>${name}</h3>`));
    assert(!hasHardcodedInContainer, 'No hardcoded branch cards in select-branch.html container');

    // Verify select-branch.js fetches dynamically via api.getBranches
    assert(selectBranchJsContent.includes('api.getBranches()'), 'select-branch.js fetches branches dynamically via api.getBranches()');
    assert(!selectBranchJsContent.includes('includeInactive=true'), 'select-branch.js does NOT use includeInactive=true');

    // 4. Persistence Mechanism Check in api.js
    console.log('\n--- TEST 4: Persistence Helpers in public/js/api.js ---');
    const apiJsContent = fs.readFileSync(path.resolve(__dirname, '../public/js/api.js'), 'utf8');
    assert(apiJsContent.includes('getSelectedBranchId'), 'api.js provides getSelectedBranchId()');
    assert(apiJsContent.includes('setSelectedBranch'), 'api.js provides setSelectedBranch()');
    assert(apiJsContent.includes('edupearl_selected_branch_id'), 'api.js uses edupearl_selected_branch_id storage key');
    assert(!apiJsContent.includes('token') || !apiJsContent.includes('localStorage.setItem(\'token\''), 'No auth tokens or JWTs stored in client storage');

    // 5. Verify Direct Access to Existing Public and Admin Pages
    console.log('\n--- TEST 5: Direct Access to Existing Public & Admin Pages ---');
    const resHome = await fetch(`${BASE_URL}/`);
    assert(resHome.status === 200, 'GET / (Homepage) returns 200 OK');

    const resServices = await fetch(`${BASE_URL}/services.html`);
    assert(resServices.status === 200, 'GET /services.html returns 200 OK');

    const resBranches = await fetch(`${BASE_URL}/branches.html`);
    assert(resBranches.status === 200, 'GET /branches.html returns 200 OK');

    const resAdminLogin = await fetch(`${BASE_URL}/admin/login.html`);
    assert(resAdminLogin.status === 200, 'GET /admin/login.html returns 200 OK');

    // 6. Homepage Verification & Absence of Forced Redirect Check
    console.log('\n--- TEST 6: Homepage Integrity & Direct Access Verification ---');
    const homeHtml = await resHome.text();
    assert(!homeHtml.includes('select-branch.html'), 'Homepage head does NOT force automatic redirect to /select-branch.html');
    assert(!homeHtml.includes('Initial branch selection verification on first visit'), 'No mandatory startup branch selection script on homepage');
    assert(homeHtml.includes('Your Global Journey Starts with the Right Guidance'), 'Homepage hero content matches approved headline');
    assert(homeHtml.includes('id="featured-container"'), 'Homepage featured services container preserved');
    assert(homeHtml.includes('id="branches-container"'), 'Homepage branches container preserved');

    // 7. System & Database Health
    console.log('\n--- TEST 7: System & Database Health ---');
    const resHealth = await fetch(`${BASE_URL}/api/health`);
    assert(resHealth.status === 200, 'GET /api/health returns 200 OK');

    const resDbHealth = await fetch(`${BASE_URL}/api/health/db`);
    assert(resDbHealth.status === 200, 'GET /api/health/db returns 200 OK');

    console.log('\n============================================================');
    console.log(`Tests Summary: ${passed} Passed, ${failed} Failed`);
    console.log('============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runTests();
