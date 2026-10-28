/**
 * ============================================================================
 * Edupearl: Cloud / Production Database Migration & Seed Script
 * ============================================================================
 * 
 * Safely initializes database tables, seed catalogs (branches and services),
 * and provisions the super-admin account idempotently.
 * 
 * Safe to execute on TiDB Cloud, Aiven MySQL, Railway MySQL, or local MySQL:
 * - Uses CREATE TABLE IF NOT EXISTS (never drops tables or data).
 * - Uses INSERT ... WHERE NOT EXISTS (never duplicates rows).
 * - Safe for re-running multiple times.
 * ============================================================================
 */

const path = require('path');
const bcrypt = require('bcryptjs');

// Load .env if present (in development or local runs)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = require('../src/config/db');

async function runMigration() {
  console.log('----------------------------------------------------');
  console.log('Edupearl: Starting Database Migration & Initialization');
  console.log('----------------------------------------------------');

  let connection;
  try {
    connection = await pool.getConnection();
    console.log('[1/5] Connected to database successfully.');

    // 1. Create admins table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL COMMENT 'Salted bcrypt hash',
        full_name VARCHAR(100) NOT NULL,
        role ENUM('super_admin', 'branch_admin', 'counselor') NOT NULL DEFAULT 'super_admin',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_login_at DATETIME NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT uq_admins_username UNIQUE (username),
        CONSTRAINT uq_admins_email UNIQUE (email),
        INDEX idx_admins_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Create branches table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) NOT NULL COMMENT 'Unique short identifier',
        name VARCHAR(100) NOT NULL COMMENT 'Branch name',
        address_line1 VARCHAR(255) NOT NULL,
        address_line2 VARCHAR(255) NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        postal_code VARCHAR(20) NOT NULL,
        country VARCHAR(100) NOT NULL DEFAULT 'India',
        phone VARCHAR(30) NULL,
        email VARCHAR(100) NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT uq_branches_code UNIQUE (code),
        INDEX idx_branches_city (city),
        INDEX idx_branches_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Create services_courses table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS services_courses (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(100) NOT NULL COMMENT 'URL-safe unique identifier',
        category ENUM('immigration_service', 'language_course') NOT NULL,
        title VARCHAR(150) NOT NULL,
        short_description VARCHAR(300) NOT NULL,
        detailed_description TEXT NULL,
        duration_info VARCHAR(100) NULL,
        is_featured BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        display_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT uq_services_courses_slug UNIQUE (slug),
        INDEX idx_services_category (category),
        INDEX idx_services_is_active (is_active),
        INDEX idx_services_display_order (display_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Create enquiries table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS enquiries (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        enquiry_reference VARCHAR(30) NOT NULL COMMENT 'Unique reference tracking code',
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        city VARCHAR(100) NULL,
        service_course_id INT UNSIGNED NULL DEFAULT NULL,
        preferred_branch_id INT UNSIGNED NULL DEFAULT NULL,
        target_country VARCHAR(100) NULL,
        message TEXT NULL,
        status ENUM('new', 'in_progress', 'contacted', 'closed', 'converted') NOT NULL DEFAULT 'new',
        counselor_notes TEXT NULL,
        ip_address VARCHAR(45) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT uq_enquiries_reference UNIQUE (enquiry_reference),
        CONSTRAINT fk_enquiries_branch 
          FOREIGN KEY (preferred_branch_id) 
          REFERENCES branches (id) 
          ON DELETE SET NULL 
          ON UPDATE CASCADE,
        CONSTRAINT fk_enquiries_service_course 
          FOREIGN KEY (service_course_id) 
          REFERENCES services_courses (id) 
          ON DELETE SET NULL 
          ON UPDATE CASCADE,
        INDEX idx_enquiries_status (status),
        INDEX idx_enquiries_created_at (created_at),
        INDEX idx_enquiries_email (email),
        INDEX idx_enquiries_phone (phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[2/5] Database tables verified / created successfully.');

    // ------------------------------------------------------------------------
    // Seed: 6 Official Branches
    // ------------------------------------------------------------------------
    const officialBranches = [
      {
        code: '01-LDH-HO',
        name: 'Edu Pearl Immigration Services & Language Point — Head Office',
        address_line1: '2nd Floor, Golden Plaza, Opp. Silver Arc, Ferozepur Road',
        address_line2: null,
        city: 'Ludhiana',
        state: 'Punjab',
        postal_code: '141001',
        country: 'India',
        phone: '0161-4683982',
        email: 'ludhiana.edupearl@gmail.com',
        is_active: true
      },
      {
        code: '02-JGN-BR',
        name: 'Edu Pearl Immigration Services & Language Point — Jagraon',
        address_line1: '2nd Floor, KK Complex, Opp. B.D.P.O. Office, Tehsil Road',
        address_line2: null,
        city: 'Jagraon',
        state: 'Punjab',
        postal_code: '142026',
        country: 'India',
        phone: '+91 91150 52624',
        email: 'pearlacademy5@gmail.com',
        is_active: true
      },
      {
        code: '06-HTR-BR',
        name: 'Edu Pearl Immigration Services & Language Point Hathur',
        address_line1: 'Opposite SBI Bank',
        address_line2: null,
        city: 'Hathur',
        state: 'Punjab',
        postal_code: '142026',
        country: 'India',
        phone: '+91 90561 96336',
        email: 'edupearlhathur@gmail.com',
        is_active: true
      },
      {
        code: '03-GGN-BR',
        name: 'Edu Pearl Immigration Services & Language Point Sri Ganganagar',
        address_line1: '123 Test Street, Ganganagar',
        address_line2: null,
        city: 'Sri Ganganagar',
        state: 'Punjab',
        postal_code: '144001',
        country: 'India',
        phone: '+91 95245 95555',
        email: 'demo-ganganagar@example.com',
        is_active: true
      },
      {
        code: '04-KPT-BR',
        name: 'Edu Pearl Immigration Services and Language Point Kapurthala',
        address_line1: 'Upstairs Lirhe Collection, opposite Bus Stand, Sukhjit Nagar',
        address_line2: 'Shivaji Nagar',
        city: 'Kapurthala',
        state: 'Punjab',
        postal_code: '144001',
        country: 'India',
        phone: '+91-92749-27408',
        email: 'demo-kapurthala@example.com',
        is_active: true
      },
      {
        code: '05-MLP-BR',
        name: 'Edu Pearl Immigration Services and Language Point Mullanpur Dakha',
        address_line1: 'Shop No. 7, New Grain Market',
        address_line2: null,
        city: 'Mullanpur Dakha, Ludhiana',
        state: 'Punjab',
        postal_code: '141101',
        country: 'India',
        phone: '+91 91150 52624',
        email: 'demo-ludhiana@example.com',
        is_active: true
      }
    ];

    for (const b of officialBranches) {
      await connection.query(`
        INSERT INTO branches (
          code, name, address_line1, address_line2, city, state, postal_code, country, phone, email, is_active
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM branches WHERE code = ?
        );
      `, [b.code, b.name, b.address_line1, b.address_line2, b.city, b.state, b.postal_code, b.country, b.phone, b.email, b.is_active, b.code]);
    }
    console.log('[3/5] Official branches catalog verified.');

    // ------------------------------------------------------------------------
    // Seed: Services & Courses
    // ------------------------------------------------------------------------
    const officialServices = [
      {
        slug: 'ielts-academic-coaching',
        category: 'language_course',
        title: 'IELTS Academic Comprehensive Preparation',
        short_description: 'Intensive classroom and mock test coaching covering Reading, Writing, Listening, and Speaking modules.',
        detailed_description: 'Structured preparation for candidates planning higher education abroad. Includes weekly timed practice tests, band-score evaluation, vocabulary building, and one-on-one speaking interview simulations.',
        duration_info: '8 Weeks (Flexible Batches)',
        is_featured: true,
        is_active: true,
        display_order: 1
      },
      {
        slug: 'pte-academic-training',
        category: 'language_course',
        title: 'PTE Academic Computer-Based Training',
        short_description: 'Computer-lab focused Pearson Test of English training emphasizing AI-scored speaking fluency and pronunciation.',
        detailed_description: 'Comprehensive preparation using specialized software labs that replicate the official Pearson testing environment. Covers all item types with real-time feedback and strategy sessions.',
        duration_info: '6 Weeks',
        is_featured: true,
        is_active: true,
        display_order: 2
      },
      {
        slug: 'spoken-english-fluency',
        category: 'language_course',
        title: 'Spoken English & Communication Skills',
        short_description: 'Foundation to advanced English conversation skills, accent neutralization, and interview readiness.',
        detailed_description: 'Designed to build confidence in daily communication, professional workplace dialogues, and academic presentations with practical group discussions and grammar refinement.',
        duration_info: '4 Weeks',
        is_featured: false,
        is_active: true,
        display_order: 3
      },
      {
        slug: 'study-visa-consultation',
        category: 'immigration_service',
        title: 'Study Visa Advisory & Filing Guidance',
        short_description: 'Personalized university matching, program selection, Statement of Purpose (SOP) guidance, and visa application filing.',
        detailed_description: 'End-to-end guidance for students aspiring to study in Canada, the UK, Australia, the USA, and Europe. Assists with document compliance, financial verification, and offer letter acquisition.',
        duration_info: 'Personalized Consultation',
        is_featured: true,
        is_active: true,
        display_order: 4
      },
      {
        slug: 'visitor-tourist-visa',
        category: 'immigration_service',
        title: 'Visitor & Tourist Visa Application Support',
        short_description: 'Document structuring, purpose-of-travel statements, and filing support for tourism and family visits.',
        detailed_description: 'Step-by-step assistance with visitor visas, financial documentation reviews, invitation letter verifications, and travel itinerary preparations for major global destinations.',
        duration_info: 'Case-by-Case Advisory',
        is_featured: false,
        is_active: true,
        display_order: 5
      },
      {
        slug: 'post-study-work-permit',
        category: 'immigration_service',
        title: 'Post-Study Work Permit Advisory',
        short_description: 'Guidance on transitional work rights, legal compliance, and documentation following overseas graduation.',
        detailed_description: 'Consultation on work permit eligibility criteria, timelines, employer compliance, and subsequent pathway requirements in study destinations.',
        duration_info: 'One-on-One Counseling',
        is_featured: false,
        is_active: true,
        display_order: 6
      }
    ];

    for (const s of officialServices) {
      await connection.query(`
        INSERT INTO services_courses (
          slug, category, title, short_description, detailed_description, duration_info, is_featured, is_active, display_order
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM services_courses WHERE slug = ?
        );
      `, [s.slug, s.category, s.title, s.short_description, s.detailed_description, s.duration_info, s.is_featured, s.is_active, s.display_order, s.slug]);
    }
    console.log('[4/5] Services and courses catalog verified.');

    // ------------------------------------------------------------------------
    // Seed: Super Admin Account
    // ------------------------------------------------------------------------
    const adminUsername = process.env.ADMIN_INITIAL_USERNAME || 'jujhar';
    const adminEmail = process.env.ADMIN_INITIAL_EMAIL || 'jujhar@edupearl.in';
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Edupearl@2026!';
    const adminFullName = process.env.ADMIN_INITIAL_NAME || 'Jujhar Singh';

    const [existingAdmins] = await connection.query(`
      SELECT id, username, email FROM admins WHERE username = ? OR email = ?
    `, [adminUsername, adminEmail]);

    if (existingAdmins.length === 0) {
      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash(adminPassword, salt);

      await connection.query(`
        INSERT INTO admins (username, email, password_hash, full_name, role, is_active)
        VALUES (?, ?, ?, ?, 'super_admin', TRUE)
      `, [adminUsername, adminEmail, hash, adminFullName]);

      console.log(`[5/5] Created initial super admin account (${adminUsername} / ${adminEmail}).`);
    } else {
      console.log(`[5/5] Super admin account already exists (${existingAdmins[0].username}).`);
    }

    console.log('----------------------------------------------------');
    console.log('Database Migration & Initialization completed successfully!');
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error('Database migration failed:', error.message || error);
    if (error.code) console.error('Error code:', error.code);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
