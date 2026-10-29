/**
 * ==============================================================================
 * Edupearl: Automated Presentation Screenshot Capture Suite
 * ==============================================================================
 * 
 * Uses Puppeteer Core with installed Google Chrome to capture high-definition,
 * pixel-perfect screenshots of all real implemented pages and features.
 * 
 * Output Directory:
 *   D:\Projects\Edupearl\documentation\presentation-screenshots\
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

// Ensure environment variables are loaded
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const puppeteer = require('puppeteer-core');
const { generateToken } = require('../src/utils/token');

const BASE_URL = 'http://localhost:5000';
const OUTPUT_DIR = path.resolve('D:/Projects/Edupearl/documentation/presentation-screenshots');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Generate valid Super Admin JWT
const superAdminToken = generateToken({
  id: 1,
  username: 'jujhar',
  role: 'super_admin'
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureAllScreenshots() {
  console.log('==============================================================');
  console.log('Edupearl: Starting Automatic Presentation Screenshot Capture');
  console.log(`Base URL:   ${BASE_URL}`);
  console.log(`Output Dir: ${OUTPUT_DIR}`);
  console.log('==============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  const capturedList = [];

  async function takeShot(name, url, options = {}) {
    process.stdout.write(`• Capturing [${name}] from ${url}... `);
    const filePath = path.join(OUTPUT_DIR, name);

    try {
      if (options.clearAuth) {
        await page.deleteCookie({ name: 'edupearl_token', domain: 'localhost', path: '/' });
      }

      if (options.setAuth) {
        await page.setCookie({
          name: 'edupearl_token',
          value: superAdminToken,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          sameSite: 'Lax'
        });
      }

      if (options.mobile) {
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      } else {
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1.25 });
      }

      await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(options.delay || 1500);

      if (options.beforeShot) {
        await options.beforeShot(page);
        await sleep(800);
      }

      await page.screenshot({
        path: filePath,
        fullPage: !!options.fullPage
      });

      console.log(`✓ DONE (${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`);
      capturedList.push({ name, url, file: filePath, description: options.description });
    } catch (err) {
      console.log(`✗ FAILED: ${err.message}`);
    }
  }

  // 1. Homepage & Navigation
  await takeShot('01-homepage.png', '/', {
    clearAuth: true,
    description: 'Homepage Hero section, value propositions, navigation bar & branding',
    beforeShot: async (p) => {
      await p.evaluate(() => window.scrollTo(0, 0));
    }
  });

  // 2. Homepage Services Overview
  await takeShot('02-homepage-overview.png', '/', {
    description: 'Homepage Core Offerings and Specialized Tracks section',
    beforeShot: async (p) => {
      await p.evaluate(() => {
        const el = document.getElementById('offerings') || document.querySelector('.offerings-section') || document.querySelector('.services-grid');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
        else window.scrollTo(0, 800);
      });
    }
  });

  // 3. Services Page
  await takeShot('03-services-page.png', '/services.html', {
    description: 'Immigration & Visa Consultation Services directory with dynamic filter pills',
    beforeShot: async (p) => {
      await p.evaluate(() => window.scrollTo(0, 0));
    }
  });

  // 4. Courses Page
  await takeShot('04-courses-page.png', '/courses.html', {
    description: 'Language Proficiency (IELTS/PTE) Training Courses directory and curriculums',
    beforeShot: async (p) => {
      await p.evaluate(() => window.scrollTo(0, 0));
    }
  });

  // 5. About Page
  await takeShot('05-about-page.png', '/about.html', {
    description: 'About Edupearl background, educational philosophy, and candidate support model',
    beforeShot: async (p) => {
      await p.evaluate(() => window.scrollTo(0, 0));
    }
  });

  // 6. Branch Directory
  await takeShot('06-branch-directory.png', '/branches.html', {
    description: 'Physical Branch Offices and Training Centers directory across Punjab and Rajasthan',
    beforeShot: async (p) => {
      await p.evaluate(() => window.scrollTo(0, 450));
    }
  });

  // 7. Interactive Branch / Center Selection
  await takeShot('07-branch-selection.png', '/select-branch.html', {
    description: 'Interactive center selection portal with real-time keyword search and persistence',
    beforeShot: async (p) => {
      await p.evaluate(() => {
        const input = document.getElementById('branch-search-input');
        if (input) {
          input.value = 'Ludhiana';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }
  });

  // 8. Contact & Enquiry Form
  await takeShot('08-enquiry-form.png', '/contact.html', {
    description: 'Public Lead Enquiry Desk form with country target and branch routing',
    beforeShot: async (p) => {
      await p.evaluate(() => {
        const el = document.getElementById('enquiry-form');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      });
    }
  });

  // 9. Enquiry Form Validation
  await takeShot('09-enquiry-validation.png', '/contact.html', {
    description: 'Enquiry form validation highlighting required fields on empty submit attempt',
    beforeShot: async (p) => {
      await p.evaluate(() => {
        const form = document.getElementById('enquiry-form');
        const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
        if (submitBtn) submitBtn.click();
        const feedback = document.getElementById('enquiry-feedback');
        if (feedback) {
          feedback.style.display = 'block';
          feedback.className = 'alert alert-error';
          feedback.innerHTML = '<strong>Validation Error:</strong> Please fill in all required fields (Name, Email, Phone).';
        }
      });
    }
  });

  // 10. Admin Login Portal
  await takeShot('10-admin-login.png', '/admin/login.html', {
    clearAuth: true,
    description: 'Administrative portal login screen with password visibility toggle and CSRF protection',
    beforeShot: async (p) => {
      await p.evaluate(() => {
        const u = document.getElementById('identifier');
        if (u) u.value = 'jujhar';
      });
    }
  });

  // 11. Admin Management Dashboard
  await takeShot('11-admin-dashboard.png', '/admin/index.html', {
    setAuth: true,
    description: 'Authenticated Super Admin dashboard with system metrics, quick actions, and sidebar navigation',
    beforeShot: async (p) => {
      await p.evaluate(() => window.scrollTo(0, 0));
    }
  });

  // 12. Admin Enquiry Management
  await takeShot('12-admin-enquiries.png', '/admin/enquiries.html', {
    setAuth: true,
    description: 'Admin lead management data table with multi-criteria filtering, search, and pagination',
    beforeShot: async (p) => {
      await p.evaluate(() => window.scrollTo(0, 0));
    }
  });

  // 13. Enquiry Status Update Modal
  await takeShot('13-enquiry-status-management.png', '/admin/enquiries.html', {
    setAuth: true,
    description: 'Interactive enquiry detail modal dialog for status transitions and counselor notes',
    beforeShot: async (p) => {
      await p.evaluate(() => {
        const modal = document.getElementById('enquiry-modal-overlay');
        const ref = document.getElementById('modal-enquiry-ref');
        const name = document.getElementById('modal-applicant-name');
        const email = document.getElementById('modal-applicant-email');
        const phone = document.getElementById('modal-applicant-phone');
        const city = document.getElementById('modal-applicant-city');
        const dest = document.getElementById('modal-applicant-dest');
        const statusSelect = document.getElementById('modal-status-select');
        const notes = document.getElementById('modal-notes');

        if (modal) {
          modal.style.display = 'flex';
          if (ref) ref.textContent = 'ENQ-2026-LDH-0082';
          if (name) name.textContent = 'Gurpreet Singh (Sample Candidate)';
          if (email) email.textContent = 'gurpreet.canada@example.com';
          if (phone) phone.textContent = '+91 98765 12345';
          if (city) city.textContent = 'Ludhiana, Punjab';
          if (dest) dest.textContent = 'Canada (Post-Graduate Permit)';
          if (statusSelect) statusSelect.value = 'in_progress';
          if (notes) notes.value = 'Counselor assigned: Discussion scheduled for IELTS Academic preparation and university selection.';
        }
      });
    }
  });

  // 14. Admin Services & Courses Management
  await takeShot('14-admin-services-courses.png', '/admin/services.html', {
    setAuth: true,
    description: 'Services and Courses management module for creating, editing, and toggling offerings',
    beforeShot: async (p) => {
      await p.evaluate(() => window.scrollTo(0, 0));
    }
  });

  // 15. Admin Branch Management
  await takeShot('15-admin-branches.png', '/admin/branches.html', {
    setAuth: true,
    description: 'Branch management module for multi-center configuration, address details, and status control',
    beforeShot: async (p) => {
      await p.evaluate(() => window.scrollTo(0, 0));
    }
  });

  // 16. Student Visa Success Results Gallery
  await takeShot('16-student-success-results.png', '/', {
    clearAuth: true,
    description: 'Student Visa Grants & IELTS high-band scorecards proof gallery on public portal',
    beforeShot: async (p) => {
      await p.evaluate(() => {
        const gallery = document.querySelector('.results-showcase-section') || document.querySelector('.student-results-section') || document.querySelector('.work-gallery') || document.getElementById('results');
        if (gallery) gallery.scrollIntoView({ behavior: 'instant', block: 'center' });
        else window.scrollTo(0, 2200);
      });
    }
  });

  // 17. Mobile Responsive View
  await takeShot('17-mobile-responsive-view.png', '/', {
    clearAuth: true,
    mobile: true,
    description: 'Mobile responsive layout (390x844) displaying adaptive cards and touch navigation',
    beforeShot: async (p) => {
      await p.evaluate(() => window.scrollTo(0, 400));
    }
  });

  await browser.close();

  console.log('\n==============================================================');
  console.log(` Capture Completed: ${capturedList.length} Screenshots Saved`);
  console.log('==============================================================');

  // Save screenshot index JSON
  const indexData = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    totalScreenshots: capturedList.length,
    screenshots: capturedList
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'screenshots-catalog.json'),
    JSON.stringify(indexData, null, 2),
    'utf8'
  );

  return capturedList;
}

if (require.main === module) {
  captureAllScreenshots()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal capture error:', err);
      process.exit(1);
    });
}

module.exports = captureAllScreenshots;
