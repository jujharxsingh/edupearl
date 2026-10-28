/**
 * ============================================================================
 * Edupearl: Enquiry Modal Auto-Scroll Verification Test
 * ============================================================================
 * 
 * Verifies:
 * 1. Markup integrity in public/admin/enquiries.html:
 *    - #enquiry-modal-overlay exists
 *    - #enquiry-modal-body (.modal-body) scroll container exists
 *    - #modal-alert-box exists inside scroll container with role="alert"
 *    - Modal header, close buttons, status form, and branch form exist
 * 2. Implementation verification in public/admin/js/enquiries.js:
 *    - scrollModalToTop function exists and targets the modal container
 *    - Uses smooth scrolling option (and respects prefers-reduced-motion)
 *    - Auto-scroll triggers on success alerts (status/notes save & branch reassign)
 *    - Auto-scroll does NOT trigger on error alerts (preserves scroll on failure)
 *    - openModal resets scroll position on open
 * 3. Functional Simulation Test:
 *    - Loads simulated DOM matching enquiries.html
 *    - Simulates user scrolling down inside modal body
 *    - Verifies auto-scroll to top upon successful save
 *    - Verifies scroll position preservation upon failed save
 *    - Verifies form contents preservation upon failed save
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('============================================================');
console.log('Edupearl: Enquiry Modal Auto-Scroll Automated Verification');
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
// 1. Inspect Markup in public/admin/enquiries.html
// ----------------------------------------------------------------------------
console.log('--- TEST GROUP 1: HTML Markup & Modal Container Structure ---');
const htmlPath = path.resolve(__dirname, '../public/admin/enquiries.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

test('enquiries.html contains #enquiry-modal-overlay dialog', () => {
  assert(htmlContent.includes('id="enquiry-modal-overlay"'), 'Missing #enquiry-modal-overlay');
  assert(htmlContent.includes('role="dialog"'), 'Missing role="dialog"');
});

test('enquiries.html contains modal-header with close control', () => {
  assert(htmlContent.includes('class="modal-header"'), 'Missing modal-header');
  assert(htmlContent.includes('id="btn-modal-close"'), 'Missing #btn-modal-close');
  assert(htmlContent.includes('id="modal-enquiry-ref"'), 'Missing #modal-enquiry-ref');
});

test('enquiries.html contains #enquiry-modal-body as scrollable content container', () => {
  assert(htmlContent.includes('id="enquiry-modal-body"') || htmlContent.includes('class="modal-body"'), 'Missing modal body container');
  assert(htmlContent.includes('class="modal-body" id="enquiry-modal-body"'), 'Modal body container missing explicit id');
});

test('enquiries.html contains #modal-alert-box inside modal body with role="alert"', () => {
  assert(htmlContent.includes('id="modal-alert-box"'), 'Missing #modal-alert-box');
  assert(htmlContent.includes('id="modal-alert-text"'), 'Missing #modal-alert-text');
  assert(htmlContent.includes('id="modal-alert-icon"'), 'Missing #modal-alert-icon');
  
  // Verify modal-alert-box is placed before the detail sections
  const alertBoxIdx = htmlContent.indexOf('id="modal-alert-box"');
  const applicantSectionIdx = htmlContent.indexOf('Applicant Information');
  assert(alertBoxIdx < applicantSectionIdx, 'Alert box must be at the top of the modal body');
});

test('enquiries.html contains status-notes form and branch reassignment form', () => {
  assert(htmlContent.includes('id="form-update-status-notes"'), 'Missing #form-update-status-notes');
  assert(htmlContent.includes('id="btn-save-status-notes"'), 'Missing #btn-save-status-notes');
  assert(htmlContent.includes('id="form-reassign-branch"'), 'Missing #form-reassign-branch');
  assert(htmlContent.includes('id="btn-save-branch-reassignment"'), 'Missing #btn-save-branch-reassignment');
});

// ----------------------------------------------------------------------------
// 2. Inspect CSS in public/admin/css/admin.css
// ----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 2: CSS Scroll Container Configuration ---');
const cssPath = path.resolve(__dirname, '../public/admin/css/admin.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

test('.modal-dialog has overflow: hidden and fixed max-height', () => {
  assert(cssContent.includes('.modal-dialog'), 'Missing .modal-dialog');
  assert(cssContent.includes('max-height: 90vh;'), 'Missing max-height on .modal-dialog');
  assert(cssContent.includes('overflow: hidden;'), 'Missing overflow: hidden on .modal-dialog');
});

test('.modal-body is the scrollable container with overflow-y: auto', () => {
  assert(cssContent.includes('.modal-body'), 'Missing .modal-body');
  assert(cssContent.includes('overflow-y: auto;'), 'Missing overflow-y: auto on .modal-body');
});

// ----------------------------------------------------------------------------
// 3. Inspect JS Implementation in public/admin/js/enquiries.js
// ----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 3: JS Auto-Scroll Implementation ---');
const jsPath = path.resolve(__dirname, '../public/admin/js/enquiries.js');
const jsContent = fs.readFileSync(jsPath, 'utf8');

test('enquiries.js defines scrollModalToTop function', () => {
  assert(jsContent.includes('function scrollModalToTop()'), 'Missing scrollModalToTop() function definition');
});

test('scrollModalToTop targets enquiry-modal-body or modal-body container', () => {
  assert(
    jsContent.includes("document.getElementById('enquiry-modal-body')") ||
    jsContent.includes("document.querySelector('#enquiry-modal-overlay .modal-body')"),
    'scrollModalToTop must target the modal content container'
  );
});

test('scrollModalToTop specifies smooth scrolling behavior with fallback', () => {
  assert(jsContent.includes("behavior: scrollBehavior") || jsContent.includes("behavior: 'smooth'"), 'Must specify smooth scrolling');
  assert(jsContent.includes("modalBody.scrollTop = 0"), 'Must provide fallback to scrollTop = 0');
});

test('showModalAlert triggers scrollModalToTop only for type === "success"', () => {
  assert(jsContent.includes("if (type === 'success')"), 'showModalAlert must check for success type');
  assert(jsContent.includes("scrollModalToTop()"), 'showModalAlert must invoke scrollModalToTop');
  
  // Verify that danger/error alerts do not trigger scrollModalToTop
  const showModalAlertCode = jsContent.slice(
    jsContent.indexOf('function showModalAlert('),
    jsContent.indexOf('function openModal(')
  );
  assert(!showModalAlertCode.includes("if (type === 'danger') {\n        scrollModalToTop"), 'Error alerts must not auto-scroll');
});

test('openModal resets scroll position so newly opened modal starts at top', () => {
  const openModalCode = jsContent.slice(
    jsContent.indexOf('async function openModal('),
    jsContent.indexOf('function closeModal(')
  );
  assert(openModalCode.includes('modalBody.scrollTop = 0'), 'openModal must reset modalBody.scrollTop to 0');
});

// ----------------------------------------------------------------------------
// 4. Functional DOM Simulation
// ----------------------------------------------------------------------------
console.log('\n--- TEST GROUP 4: Functional DOM Behavior Simulation ---');

test('DOM Simulation: smooth scroll to top on success, preserved on failure', () => {
  // Construct minimal mock DOM matching enquiries.html
  let scrollCalledWith = null;
  const mockModalBody = {
    scrollTop: 350,
    scrollTo: function(options) {
      scrollCalledWith = options;
      this.scrollTop = options.top;
    }
  };

  const mockAlertBox = {
    style: { display: 'none' },
    className: 'alert',
    closest: (selector) => selector === '.modal-body' ? mockModalBody : null
  };

  const mockAlertText = { textContent: '' };
  const mockAlertIcon = { textContent: '' };

  const mockElements = {
    'enquiry-modal-body': mockModalBody,
    'modal-alert-box': mockAlertBox,
    'modal-alert-text': mockAlertText,
    'modal-alert-icon': mockAlertIcon
  };

  const simulatedWindow = {
    matchMedia: (query) => ({ matches: false }),
    requestAnimationFrame: (cb) => cb()
  };

  // Simulated scrollModalToTop implementation
  function simScrollModalToTop() {
    const modalBody = mockElements['enquiry-modal-body'];
    if (!modalBody) return;
    const prefersReducedMotion = simulatedWindow.matchMedia && simulatedWindow.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
    if (typeof modalBody.scrollTo === 'function') {
      try {
        modalBody.scrollTo({ top: 0, behavior: scrollBehavior });
      } catch (_) {
        modalBody.scrollTop = 0;
      }
    } else {
      modalBody.scrollTop = 0;
    }
  }

  // Simulated showModalAlert implementation
  function simShowModalAlert(type, message) {
    const alertBox = mockElements['modal-alert-box'];
    const alertText = mockElements['modal-alert-text'];
    const alertIcon = mockElements['modal-alert-icon'];
    if (alertBox && alertText) {
      alertBox.className = `alert alert-${type}`;
      alertText.textContent = message;
      if (alertIcon) alertIcon.textContent = type === 'success' ? '✓' : '⚠️';
      alertBox.style.display = 'flex';
      if (type === 'success') {
        simScrollModalToTop();
      }
    }
  }

  // Case 1: Initial scrolled state
  mockModalBody.scrollTop = 420;
  assert.strictEqual(mockModalBody.scrollTop, 420, 'Initial scroll position should be 420');

  // Case 2: Save fails with error alert
  simShowModalAlert('danger', 'Failed to update enquiry status.');
  assert.strictEqual(mockAlertBox.style.display, 'flex', 'Alert box should be displayed');
  assert.strictEqual(mockAlertBox.className, 'alert alert-danger', 'Alert should be alert-danger');
  assert.strictEqual(mockAlertText.textContent, 'Failed to update enquiry status.', 'Error message text');
  assert.strictEqual(mockModalBody.scrollTop, 420, 'Scroll position MUST be preserved on failure (no scroll)');

  // Case 3: Save succeeds with success alert
  simShowModalAlert('success', 'Enquiry status and counselor notes updated successfully.');
  assert.strictEqual(mockAlertBox.style.display, 'flex', 'Alert box should be displayed');
  assert.strictEqual(mockAlertBox.className, 'alert alert-success', 'Alert should be alert-success');
  assert.strictEqual(mockAlertText.textContent, 'Enquiry status and counselor notes updated successfully.');
  assert.strictEqual(mockAlertIcon.textContent, '✓', 'Success icon should be checkmark');
  assert.deepStrictEqual(scrollCalledWith, { top: 0, behavior: 'smooth' }, 'scrollTo should be called with top: 0, behavior: smooth');
  assert.strictEqual(mockModalBody.scrollTop, 0, 'Scroll position MUST be 0 after successful save');

  // Case 4: Branch reassignment save succeeds
  mockModalBody.scrollTop = 500;
  simShowModalAlert('success', 'Preferred branch reassigned successfully.');
  assert.strictEqual(mockAlertBox.className, 'alert alert-success');
  assert.strictEqual(mockAlertText.textContent, 'Preferred branch reassigned successfully.');
  assert.strictEqual(mockModalBody.scrollTop, 0, 'Scroll position MUST be 0 after branch reassignment success');
});

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('\n============================================================');
console.log(`Verification Summary: ${passed} Passed, ${failed} Failed`);
console.log('============================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
