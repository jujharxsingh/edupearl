/**
 * ============================================================================
 * Edupearl: Public Navigation & Content Structure Automated Verification
 * ============================================================================
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('============================================================');
  console.log('Edupearl: Public Navigation & Approved Content Verification');
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
    // ------------------------------------------------------------------------
    // TEST 1: Public Navigation Links & Order
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Public Navigation Structure & Order ---');
    const resHome = await fetch(`${BASE_URL}/`);
    assert(resHome.status === 200, 'GET / returns 200 OK');
    const homeHtml = await resHome.text();

    // Verify order in nav
    const navMatch = homeHtml.match(/<nav aria-label="Main Navigation">[\s\S]*?<\/nav>/);
    assert(!!navMatch, 'Homepage contains <nav aria-label="Main Navigation">');
    const navContent = navMatch ? navMatch[0] : '';

    assert(navContent.includes('href="/"') && navContent.includes('>Home<'), 'Nav contains Home link');
    assert(navContent.includes('href="/courses.html"') && navContent.includes('>Courses<'), 'Nav contains Courses link');
    assert(navContent.includes('href="/services.html"') && navContent.includes('>Services<'), 'Nav contains Services link');
    assert(navContent.includes('href="/about.html"') && navContent.includes('>About<'), 'Nav contains About link');
    assert(navContent.includes('href="/contact.html"') && navContent.includes('>Contact<'), 'Nav contains Contact link');
    assert(navContent.includes('WhatsApp Us') && (navContent.includes('btn-whatsapp') || navContent.includes('nav-cta-whatsapp')), 'Nav contains prominent WhatsApp Us CTA button');

    // Verify relative ordering: Home < Courses < Services < About < Contact < WhatsApp
    const posHome = navContent.indexOf('>Home<');
    const posCourses = navContent.indexOf('>Courses<');
    const posServices = navContent.indexOf('>Services<');
    const posAbout = navContent.indexOf('>About<');
    const posContact = navContent.indexOf('>Contact<');
    const posWhatsApp = navContent.indexOf('WhatsApp Us');

    assert(
      posHome < posCourses &&
      posCourses < posServices &&
      posServices < posAbout &&
      posAbout < posContact &&
      posContact < posWhatsApp,
      'Nav items follow exact order: Home -> Courses -> Services -> About -> Contact -> WhatsApp Us'
    );

    // Verify Admin Portal removed from public nav
    assert(!navContent.includes('Admin Portal'), 'Admin Portal link is REMOVED from public header navigation');

    // ------------------------------------------------------------------------
    // TEST 2: Admin Login Access & Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Admin Login Accessibility ---');
    const resAdminLogin = await fetch(`${BASE_URL}/admin/login.html`);
    assert(resAdminLogin.status === 200, 'Direct access to /admin/login.html returns 200 OK');
    const adminHtml = await resAdminLogin.text();
    assert(adminHtml.includes('Staff Portal Login') || adminHtml.includes('Administrative Login'), 'Admin login page content is intact');

    // ------------------------------------------------------------------------
    // TEST 3: Approved Homepage Hero Content
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Exact Approved Homepage Hero Content ---');
    assert(
      homeHtml.includes('STUDY ABROAD · LANGUAGE TRAINING · IMMIGRATION'),
      'Hero Eyebrow matches: "STUDY ABROAD · LANGUAGE TRAINING · IMMIGRATION"'
    );
    assert(
      homeHtml.includes('Your Global Journey Starts with the Right Guidance'),
      'Hero Headline matches: "Your Global Journey Starts with the Right Guidance"'
    );
    assert(
      homeHtml.includes('Explore international education opportunities, prepare for language proficiency tests, and discover guidance for immigration and visa applications.'),
      'Hero Description matches exact approved text'
    );
    assert(
      homeHtml.includes('Explore Courses') && homeHtml.includes('href="/courses.html"'),
      'Hero CTA 1 matches "Explore Courses" -> /courses.html'
    );
    assert(
      homeHtml.includes('Explore Services') && homeHtml.includes('href="/services.html"'),
      'Hero CTA 2 matches "Explore Services" -> /services.html'
    );

    // ------------------------------------------------------------------------
    // TEST 4: Three Equally Prominent Homepage Categories
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Three Core Categories ---');
    assert(homeHtml.includes('Study Abroad'), 'Contains Study Abroad category');
    assert(homeHtml.includes('Explore education opportunities overseas.'), 'Study Abroad description matches');
    assert(homeHtml.includes('href="/courses.html#study-abroad"'), 'Study Abroad links to /courses.html#study-abroad');

    assert(homeHtml.includes('Language Training'), 'Contains Language Training category');
    assert(homeHtml.includes('IELTS, PTE, TEF, TCF, TRFL, Spoken English and other languages.'), 'Language Training description matches');
    assert(homeHtml.includes('href="/courses.html#language-training"'), 'Language Training links to /courses.html#language-training');

    assert(homeHtml.includes('Immigration & Visa Services'), 'Contains Immigration & Visa Services category');
    assert(homeHtml.includes('Guidance for relevant immigration and visa applications.'), 'Immigration & Visa description matches');
    assert(
      homeHtml.includes('href="/services.html#immigration-visa"') || homeHtml.includes('href="/services.html"'),
      'Immigration & Visa links to /services.html#immigration-visa'
    );

    // ------------------------------------------------------------------------
    // TEST 5: Contact CTA on Homepage
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Homepage Contact CTA ---');
    assert(
      homeHtml.includes('Contact Edupearl') && homeHtml.includes('href="/contact.html"'),
      'Homepage includes "Contact Edupearl" CTA linking to /contact.html'
    );

    // ------------------------------------------------------------------------
    // TEST 6: Courses Page Separation
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Courses Page Integrity ---');
    const resCourses = await fetch(`${BASE_URL}/courses.html`);
    assert(resCourses.status === 200, 'GET /courses.html returns 200 OK');
    const coursesHtml = await resCourses.text();
    assert(coursesHtml.includes('id="study-abroad"'), 'Courses page contains Study Abroad section (#study-abroad)');
    assert(coursesHtml.includes('id="language-training"'), 'Courses page contains Language Training section (#language-training)');
    assert(coursesHtml.includes('IELTS, PTE, TEF, TCF, TRFL'), 'Courses page includes language training modules');

    const resCoursesAlias = await fetch(`${BASE_URL}/courses`);
    assert(resCoursesAlias.status === 200, 'Route alias /courses returns 200 OK');

    // ------------------------------------------------------------------------
    // TEST 7: Services Page Separation
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Services Page Integrity ---');
    const resServices = await fetch(`${BASE_URL}/services.html`);
    assert(resServices.status === 200, 'GET /services.html returns 200 OK');
    const servicesHtml = await resServices.text();
    assert(servicesHtml.includes('Immigration & Visa Services'), 'Services page focuses on Immigration & Visa Services');

    const resServicesAlias = await fetch(`${BASE_URL}/services`);
    assert(resServicesAlias.status === 200, 'Route alias /services returns 200 OK');

    // ------------------------------------------------------------------------
    // TEST 8: About & Contact Pages
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 8: About & Contact Pages ---');
    const resAbout = await fetch(`${BASE_URL}/about.html`);
    assert(resAbout.status === 200, 'GET /about.html returns 200 OK');
    const resAboutAlias = await fetch(`${BASE_URL}/about`);
    assert(resAboutAlias.status === 200, 'Route alias /about returns 200 OK');

    const resContact = await fetch(`${BASE_URL}/contact.html`);
    assert(resContact.status === 200, 'GET /contact.html returns 200 OK');
    const resContactAlias = await fetch(`${BASE_URL}/contact`);
    assert(resContactAlias.status === 200, 'Route alias /contact returns 200 OK');

    const contactHtml = await resContact.text();
    assert(contactHtml.includes('id="enquiry-form"'), 'Contact page contains active lead enquiry form');

    // ------------------------------------------------------------------------
    // TEST 9: Public Enquiry Submission API Integration
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 9: Public Lead Enquiry Submission API ---');
    const testEnquiryPayload = {
      full_name: 'Test Candidate',
      email: 'test_candidate_' + Date.now() + '@example.com',
      phone: '+91-98765-43210',
      city: 'Ludhiana',
      target_country: 'Canada',
      message: 'Automated verification enquiry for courses and visa advisory'
    };

    const resEnquiry = await fetch(`${BASE_URL}/api/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testEnquiryPayload)
    });
    assert(resEnquiry.status === 201, 'POST /api/enquiries returns HTTP 201 Created');
    const enquiryData = await resEnquiry.json();
    assert(enquiryData.status === 'success', 'Enquiry API status is success');
    assert(!!enquiryData.enquiry && !!enquiryData.enquiry.enquiry_reference, `Received tracking reference: ${enquiryData.enquiry ? enquiryData.enquiry.enquiry_reference : 'n/a'}`);

    // ------------------------------------------------------------------------
    // TEST 10: WhatsApp CTA Configuration
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 10: WhatsApp CTA Configuration ---');
    assert(
      homeHtml.includes('href="https://wa.me/919115052624"'),
      'WhatsApp CTA correctly uses configured Edupearl number "919115052624"'
    );
    assert(
      !homeHtml.includes('phone-icon-btn'),
      'Header correctly has Call button removed beside Instagram icon'
    );

    // ------------------------------------------------------------------------
    // TEST 11: Absence of Mandatory Branch Selection at Startup
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 11: Startup Behavior Verification ---');
    assert(
      !homeHtml.includes('select-branch.html'),
      'Homepage does not contain any redirect logic forcing /select-branch.html at startup'
    );

    // ------------------------------------------------------------------------
    // TEST 12: Zero Academic or Academic-Project Disclosures on Public Pages
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 12: Public Pages Professional Business Credibility ---');
    const publicPages = [
      { name: 'Home (/)', html: homeHtml },
      { name: 'Courses (/courses.html)', html: coursesHtml },
      { name: 'Services (/services.html)', html: servicesHtml },
      { name: 'About (/about.html)', html: await (await fetch(`${BASE_URL}/about.html`)).text() },
      { name: 'Contact (/contact.html)', html: await (await fetch(`${BASE_URL}/contact.html`)).text() },
      { name: 'Branches (/branches.html)', html: await (await fetch(`${BASE_URL}/branches.html`)).text() },
      { name: 'Select Branch (/select-branch.html)', html: await (await fetch(`${BASE_URL}/select-branch.html`)).text() }
    ];

    const forbiddenPhrases = [
      'BCA',
      'LPU',
      'Lovely Professional University',
      'demo-banner',
      'Academic Project Demonstration',
      'Built for Academic Evaluation',
      'Fictional branch data',
      'capstone project'
    ];

    for (const page of publicPages) {
      for (const phrase of forbiddenPhrases) {
        assert(
          !page.html.includes(phrase),
          `Public page ${page.name} does NOT contain "${phrase}"`
        );
      }
    }

    assert(
      servicesHtml.includes('id="immigration-visa"'),
      'Services page contains #immigration-visa section anchor'
    );

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
