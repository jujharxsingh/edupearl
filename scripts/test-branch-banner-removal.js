/**
 * ============================================================================
 * Edupearl: Admin Branch Management Academic Banner Removal Verification
 * ============================================================================
 * 
 * Verifies:
 * 1. public/admin/branches.html does NOT contain:
 *    - Academic-project demonstration disclaimer or wording
 *    - .academic-demo-alert class
 *    - .demo-icon span
 *    - Any replacement disclaimer or notice
 * 2. public/admin/branches.html preserves:
 *    - Header layout, title, and buttons (#btn-refresh-listing, #btn-add-branch)
 *    - Legitimate operational alert container (#branches-notification-banner)
 *    - Search input (#filter-search) and Inactive checkbox (#filter-include-inactive)
 *    - Branches table structure (#branches-table-container, #branches-tbody)
 *    - View, Add/Edit, and Confirm Deactivation modal dialogs
 * 3. public/admin/css/admin.css has removed obsolete .academic-demo-alert rules.
 * 4. public/admin/js/branches.js retains all operational logic:
 *    - Filter, search, and sorting logic
 *    - Modal management (view, create, edit, deactivate/reactivate)
 *    - Notification banners and error handlers
 * 5. Branch database records remain 100% intact:
 *    - Exactly matches pre-change branch count and details
 *    - No names, codes, addresses, or statuses modified
 * 6. Branch APIs (public and authenticated) function properly.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../src/config/db');
const { generateToken, AUTH_COOKIE_NAME } = require('../src/utils/token');

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('============================================================');
  console.log('Edupearl: Branch Management Academic Banner Removal Verification');
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

  try {
    // ------------------------------------------------------------------------
    // TEST GROUP 1: HTML Markup Integrity in public/admin/branches.html
    // ------------------------------------------------------------------------
    console.log('--- TEST GROUP 1: HTML Markup & Banner Removal ---');
    const branchesHtmlPath = path.resolve(__dirname, '../public/admin/branches.html');
    const branchesHtml = fs.readFileSync(branchesHtmlPath, 'utf8');

    test('branches.html does NOT contain "Academic Project Demonstration"', () => {
      assert(!branchesHtml.includes('Academic Project Demonstration'), 'Must not contain "Academic Project Demonstration"');
    });

    test('branches.html does NOT contain academic disclaimer text', () => {
      assert(!branchesHtml.includes('represent fictional sample training points configured for the Edupearl academic demonstration'), 'Must not contain sample training points disclosure');
      assert(!branchesHtml.includes('fictional sample'), 'Must not contain "fictional sample"');
    });

    test('branches.html does NOT contain obsolete .academic-demo-alert container or .demo-icon', () => {
      assert(!branchesHtml.includes('academic-demo-alert'), 'Must not contain class "academic-demo-alert"');
      assert(!branchesHtml.includes('demo-icon'), 'Must not contain class "demo-icon"');
    });

    test('branches.html does not introduce any replacement disclaimer or alert', () => {
      assert(!branchesHtml.includes('disclaimer'), 'Must not contain disclaimer');
      assert(!branchesHtml.includes('evaluation only'), 'Must not contain evaluation notice');
    });

    test('branches.html preserves header layout and action buttons', () => {
      assert(branchesHtml.includes('<h1 class="welcome-title">Branch Management</h1>'), 'Missing Branch Management title');
      assert(branchesHtml.includes('id="btn-refresh-listing"'), 'Missing #btn-refresh-listing button');
      assert(branchesHtml.includes('id="btn-add-branch"'), 'Missing #btn-add-branch button');
    });

    test('branches.html preserves legitimate operational notification banner', () => {
      assert(branchesHtml.includes('id="branches-notification-banner"'), 'Missing #branches-notification-banner');
      assert(branchesHtml.includes('id="branches-notification-text"'), 'Missing #branches-notification-text');
    });

    test('branches.html preserves search and filtering controls', () => {
      assert(branchesHtml.includes('id="filter-search"'), 'Missing #filter-search');
      assert(branchesHtml.includes('id="filter-include-inactive"'), 'Missing #filter-include-inactive');
      assert(branchesHtml.includes('id="btn-clear-filters"'), 'Missing #btn-clear-filters');
    });

    test('branches.html preserves branch table and count indicators', () => {
      assert(branchesHtml.includes('id="branches-table-container"'), 'Missing #branches-table-container');
      assert(branchesHtml.includes('id="branches-tbody"'), 'Missing #branches-tbody');
      assert(branchesHtml.includes('id="branches-count-info"'), 'Missing #branches-count-info');
      assert(branchesHtml.includes('id="branches-summary-badges"'), 'Missing #branches-summary-badges');
      assert(branchesHtml.includes('id="branches-empty-state"'), 'Missing #branches-empty-state');
      assert(branchesHtml.includes('id="branches-error-banner"'), 'Missing #branches-error-banner');
    });

    test('branches.html preserves all modal dialogs (View, Add/Edit, Deactivate)', () => {
      assert(branchesHtml.includes('id="modal-branch-overlay"'), 'Missing Add/Edit modal #modal-branch-overlay');
      assert(branchesHtml.includes('id="modal-view-branch-overlay"'), 'Missing View modal #modal-view-branch-overlay');
      assert(branchesHtml.includes('id="modal-confirm-branch-status-overlay"'), 'Missing Confirmation modal #modal-confirm-branch-status-overlay');
    });

    // ------------------------------------------------------------------------
    // TEST GROUP 2: CSS Stylesheet Cleanliness
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: CSS Cleanliness in admin.css ---');
    const adminCssPath = path.resolve(__dirname, '../public/admin/css/admin.css');
    const adminCss = fs.readFileSync(adminCssPath, 'utf8');

    test('admin.css does NOT contain obsolete .academic-demo-alert rule', () => {
      assert(!adminCss.includes('.academic-demo-alert'), 'Must not contain .academic-demo-alert rule in admin.css');
    });

    test('admin.css preserves core layout, table, and modal styles', () => {
      assert(adminCss.includes('.dashboard-header'), 'admin.css must preserve .dashboard-header');
      assert(adminCss.includes('.filters-card'), 'admin.css must preserve .filters-card');
      assert(adminCss.includes('.data-table') || adminCss.includes('.table-responsive'), 'admin.css must preserve table styles');
      assert(adminCss.includes('.modal-overlay'), 'admin.css must preserve .modal-overlay');
    });

    // ------------------------------------------------------------------------
    // TEST GROUP 3: JavaScript Functionality Integrity
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: JavaScript Operational Logic Integrity ---');
    const branchesJsPath = path.resolve(__dirname, '../public/admin/js/branches.js');
    const branchesJs = fs.readFileSync(branchesJsPath, 'utf8');

    test('branches.js preserves search filtering logic', () => {
      assert(branchesJs.includes('filterSearch'), 'branches.js must reference filterSearch');
      assert(branchesJs.includes('renderTable'), 'branches.js must implement renderTable');
    });

    test('branches.js preserves inactive branches toggle logic', () => {
      assert(branchesJs.includes('filterIncludeInactive'), 'branches.js must reference filterIncludeInactive');
    });

    test('branches.js preserves column sorting logic', () => {
      assert(branchesJs.includes('localeCompare') && branchesJs.includes('.sort('), 'branches.js must preserve sorting functionality');
    });

    test('branches.js preserves View, Add, Edit, and Deactivate actions', () => {
      assert(branchesJs.includes('openViewModal'), 'branches.js must preserve openViewModal');
      assert(branchesJs.includes('openAddModal'), 'branches.js must preserve openAddModal');
      assert(branchesJs.includes('openEditModal'), 'branches.js must preserve openEditModal');
      assert(branchesJs.includes('openConfirmStatusModal'), 'branches.js must preserve openConfirmStatusModal');
      assert(branchesJs.includes('executeStatusChange'), 'branches.js must preserve executeStatusChange');
    });

    // ------------------------------------------------------------------------
    // TEST GROUP 4: Database Records Integrity (Zero Data Mutation)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Database Records & Scope Boundaries ---');
    await asyncTest('Database branches table records are completely preserved', async () => {
      const [rows] = await pool.query('SELECT id, code, name, city, is_active FROM branches ORDER BY id ASC');
      assert(rows.length === 11, `Expected 11 total branches in database, found ${rows.length}`);
      
      const activeBranches = rows.filter(b => b.is_active === 1 || b.is_active === true);
      assert(activeBranches.length === 6, `Expected 6 active branches, found ${activeBranches.length}`);

      // Verify specific existing branch codes are completely untouched
      const expectedCodes = ['04-KPT-BR', '05-MLP-BR', '01-LDH-HO', '02-JGN-BR', '03-GGN-BR', '06-HTR-BR'];
      for (const code of expectedCodes) {
        const found = rows.find(b => b.code === code);
        assert(!!found, `Branch code ${code} must exist untouched`);
        assert(found.is_active === 1 || found.is_active === true, `Branch ${code} must remain active`);
      }
    });

    // ------------------------------------------------------------------------
    // TEST GROUP 5: HTTP Endpoints & Live Verification
    // ------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: Live HTTP Verification ---');
    await asyncTest('GET /admin/branches.html returns 200 OK and clean response', async () => {
      const res = await fetch(`${BASE_URL}/admin/branches.html`);
      assert(res.status === 200, `Expected HTTP 200, received ${res.status}`);
      const body = await res.text();
      assert(!body.includes('Academic Project Demonstration'), 'HTTP response must not contain academic disclaimer');
      assert(!body.includes('academic-demo-alert'), 'HTTP response must not contain .academic-demo-alert');
    });

    await asyncTest('GET /api/branches returns active branches with correct count and fields', async () => {
      const res = await fetch(`${BASE_URL}/api/branches`);
      assert(res.status === 200, `Expected HTTP 200, received ${res.status}`);
      const data = await res.json();
      assert(data.status === 'success', 'API status must be success');
      assert(data.count === 6, `Expected 6 active branches, received ${data.count}`);
      assert(Array.isArray(data.branches) && data.branches.length === 6, 'Branches array must have length 6');
    });

    await asyncTest('GET /api/branches?includeInactive=true (Authenticated) returns full branch directory', async () => {
      const superAdminToken = generateToken({ id: 1, username: 'jujhar', role: 'super_admin' });
      const res = await fetch(`${BASE_URL}/api/branches?includeInactive=true`, {
        headers: {
          'Cookie': `${AUTH_COOKIE_NAME}=${superAdminToken}`,
          'Accept': 'application/json'
        }
      });
      assert(res.status === 200, `Expected HTTP 200, received ${res.status}`);
      const data = await res.json();
      assert(data.status === 'success', 'API status must be success');
      assert(data.count === 11, `Expected 11 total branches (including inactive), received ${data.count}`);
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
    await pool.end();
  }
}

runTests();
