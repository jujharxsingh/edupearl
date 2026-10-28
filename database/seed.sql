-- ============================================================================
-- Edu Pearl Immigration Services & Language Point
-- Development Seed Data (Milestone 2)
-- ============================================================================
-- Purpose: Populates initial sample services, courses, and clearly labeled
--          fictional branch/enquiry test records for development and viva demos.
-- 
-- Safety Guarantees:
--  1. Re-run Safe & Idempotent:
--     Uses targeted `INSERT ... SELECT ... WHERE NOT EXISTS (...)`.
--     If a record with the same unique identifier (code, slug, enquiry_reference)
--     already exists, it is completely skipped and existing data is left untouched.
--     The entire script can be rerun repeatedly without throwing duplicate key errors.
--  2. No Error Suppression:
--     Does NOT use `INSERT IGNORE`. Genuine data-integrity errors (type mismatches,
--     string truncations, invalid ENUM values, constraint failures) are NOT
--     suppressed and will be reported immediately by MySQL.
--  3. Relational Foreign Key Guarantee (Zero NULL Foreign Keys):
--     Enquiry inserts obtain parent IDs directly via `INNER JOIN` on `branches` and
--     `services_courses`. If a parent record is missing, the INNER JOIN matches 0 rows,
--     inserting zero enquiry rows rather than inserting an enquiry with NULL foreign keys.
--  4. Transparent Diagnostics:
--     Includes an informational diagnostic query before enquiry inserts to display
--     the presence or absence of required parent records in the client results grid.
--  5. Clean & Standard SQL:
--     Uses NO stored procedures, NO DELIMITER blocks, NO DROP, NO DELETE, and NO TRUNCATE.
--     Executes cleanly in MySQL Workbench via either batch execution (Ctrl+Shift+Enter)
--     or line-by-line stepping (Ctrl+Enter).
--  6. Administrative Security:
--     Contains zero default administrator accounts with known or plaintext passwords.
-- ============================================================================

USE edupearl_db;

-- ----------------------------------------------------------------------------
-- 1. Seed: branches (Fictional Test Locations Only)
-- ----------------------------------------------------------------------------
-- All addresses and phone numbers below are strictly fictional placeholders
-- using reserved test formats (+91-00000-xxxxx and @example.com).
-- Real branch details will be entered through the management interface.
-- Duplicate check: uq_branches_code (code column)
-- ----------------------------------------------------------------------------

-- Branch 1: Demo Main Campus (Jalandhar)
INSERT INTO branches (
    code, name, address_line1, address_line2, city, state, postal_code, country, phone, email, is_active
)
SELECT 
    'DEMO-BR-01',
    '[DEMO / TEST] Main Campus Training Centre',
    '100 Fictional Knowledge Hub, Block A',
    'Near Demo Civic Plaza',
    'Jalandhar',
    'Punjab',
    '144001',
    'India',
    '+91-00000-00001',
    'demo-jalandhar@example.com',
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM branches WHERE code = 'DEMO-BR-01'
);

-- Branch 2: Demo City Centre (Ludhiana)
INSERT INTO branches (
    code, name, address_line1, address_line2, city, state, postal_code, country, phone, email, is_active
)
SELECT 
    'DEMO-BR-02',
    '[DEMO / TEST] City Centre Coaching Point',
    '200 Demo Academy Avenue, 2nd Floor',
    'Opposite Test Commerce Complex',
    'Ludhiana',
    'Punjab',
    '141001',
    'India',
    '+91-00000-00002',
    'demo-ludhiana@example.com',
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM branches WHERE code = 'DEMO-BR-02'
);


-- ----------------------------------------------------------------------------
-- 2. Seed: services_courses (Language Courses & Immigration Services)
-- ----------------------------------------------------------------------------
-- Standard curriculum descriptions and service categories.
-- No fake testimonials or unverified business metrics.
-- Duplicate check: uq_services_courses_slug (slug column)
-- ----------------------------------------------------------------------------

-- Course 1: IELTS Academic
INSERT INTO services_courses (
    slug, category, title, short_description, detailed_description, duration_info, is_featured, is_active, display_order
)
SELECT 
    'ielts-academic-coaching',
    'language_course',
    'IELTS Academic Comprehensive Preparation',
    'Intensive classroom and mock test coaching covering Reading, Writing, Listening, and Speaking modules.',
    'Structured preparation for candidates planning higher education abroad. Includes weekly timed practice tests, band-score evaluation, vocabulary building, and one-on-one speaking interview simulations.',
    '8 Weeks (Flexible Batches)',
    TRUE,
    TRUE,
    1
WHERE NOT EXISTS (
    SELECT 1 FROM services_courses WHERE slug = 'ielts-academic-coaching'
);

-- Course 2: PTE Academic
INSERT INTO services_courses (
    slug, category, title, short_description, detailed_description, duration_info, is_featured, is_active, display_order
)
SELECT 
    'pte-academic-training',
    'language_course',
    'PTE Academic Computer-Based Training',
    'Computer-lab focused Pearson Test of English training emphasizing AI-scored speaking fluency and pronunciation.',
    'Comprehensive preparation using specialized software labs that replicate the official Pearson testing environment. Covers all item types with real-time feedback and strategy sessions.',
    '6 Weeks',
    TRUE,
    TRUE,
    2
WHERE NOT EXISTS (
    SELECT 1 FROM services_courses WHERE slug = 'pte-academic-training'
);

-- Course 3: Spoken English
INSERT INTO services_courses (
    slug, category, title, short_description, detailed_description, duration_info, is_featured, is_active, display_order
)
SELECT 
    'spoken-english-fluency',
    'language_course',
    'Spoken English & Communication Skills',
    'Foundation to advanced English conversation skills, accent neutralization, and interview readiness.',
    'Designed to build confidence in daily communication, professional workplace dialogues, and academic presentations with practical group discussions and grammar refinement.',
    '4 Weeks',
    FALSE,
    TRUE,
    3
WHERE NOT EXISTS (
    SELECT 1 FROM services_courses WHERE slug = 'spoken-english-fluency'
);

-- Service 1: Study Visa
INSERT INTO services_courses (
    slug, category, title, short_description, detailed_description, duration_info, is_featured, is_active, display_order
)
SELECT 
    'study-visa-consultation',
    'immigration_service',
    'Study Visa Advisory & Filing Guidance',
    'Personalized university matching, program selection, Statement of Purpose (SOP) guidance, and visa application filing.',
    'End-to-end guidance for students aspiring to study in Canada, the UK, Australia, the USA, and Europe. Assists with document compliance, financial verification, and offer letter acquisition.',
    'Personalized Consultation',
    TRUE,
    TRUE,
    4
WHERE NOT EXISTS (
    SELECT 1 FROM services_courses WHERE slug = 'study-visa-consultation'
);

-- Service 2: Visitor & Tourist Visa
INSERT INTO services_courses (
    slug, category, title, short_description, detailed_description, duration_info, is_featured, is_active, display_order
)
SELECT 
    'visitor-tourist-visa',
    'immigration_service',
    'Visitor & Tourist Visa Application Support',
    'Document structuring, purpose-of-travel statements, and filing support for tourism and family visits.',
    'Step-by-step assistance with visitor visas, financial documentation reviews, invitation letter verifications, and travel itinerary preparations for major global destinations.',
    'Case-by-Case Advisory',
    FALSE,
    TRUE,
    5
WHERE NOT EXISTS (
    SELECT 1 FROM services_courses WHERE slug = 'visitor-tourist-visa'
);

-- Service 3: Post-Study Work Permit
INSERT INTO services_courses (
    slug, category, title, short_description, detailed_description, duration_info, is_featured, is_active, display_order
)
SELECT 
    'post-study-work-permit',
    'immigration_service',
    'Post-Study Work Permit Advisory',
    'Guidance on transitional work rights, legal compliance, and documentation following overseas graduation.',
    'Consultation on work permit eligibility criteria, timelines, employer compliance, and subsequent pathway requirements in study destinations.',
    'One-on-One Counseling',
    FALSE,
    TRUE,
    6
WHERE NOT EXISTS (
    SELECT 1 FROM services_courses WHERE slug = 'post-study-work-permit'
);


-- ----------------------------------------------------------------------------
-- 3. Security Policy for admins Table (NO DEFAULT/PLAINTEXT ACCOUNTS)
-- ----------------------------------------------------------------------------
-- CRITICAL SECURITY NOTICE:
-- As required by secure engineering best practices and academic standards:
--   - No admin accounts with default or known passwords (e.g. 'admin'/'admin123')
--     are inserted here.
--   - In Milestone 3, administrative users will be created via a dedicated Node.js
--     CLI script that salts and hashes the password locally using bcrypt before
--     inserting into the database.
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 4. Diagnostic Check & Seed: enquiries
-- ----------------------------------------------------------------------------
-- Demonstrates foreign key relationships between enquiries, branches, and services.
-- ----------------------------------------------------------------------------

-- Step 4.1: Informational Diagnostic Query
-- Reports the presence or absence of each required parent record in your SQL
-- client results grid.
-- NOTE: This informational query displays diagnostics; it does NOT halt script execution.
-- The subsequent enquiry inserts rely on INNER JOIN to strictly enforce foreign key presence.
SELECT 
    'DEMO-BR-01' AS expected_identifier,
    'Branch' AS record_type,
    CASE WHEN COUNT(*) > 0 THEN 'FOUND' ELSE 'MISSING' END AS status
FROM branches WHERE code = 'DEMO-BR-01'
UNION ALL
SELECT 
    'DEMO-BR-02',
    'Branch',
    CASE WHEN COUNT(*) > 0 THEN 'FOUND' ELSE 'MISSING' END
FROM branches WHERE code = 'DEMO-BR-02'
UNION ALL
SELECT 
    'ielts-academic-coaching',
    'Service / Course',
    CASE WHEN COUNT(*) > 0 THEN 'FOUND' ELSE 'MISSING' END
FROM services_courses WHERE slug = 'ielts-academic-coaching'
UNION ALL
SELECT 
    'study-visa-consultation',
    'Service / Course',
    CASE WHEN COUNT(*) > 0 THEN 'FOUND' ELSE 'MISSING' END
FROM services_courses WHERE slug = 'study-visa-consultation';

-- Step 4.2: Insert Demo Enquiry 1 (IELTS Academic at Demo Branch 1)
-- Obtains parent IDs exclusively from verified rows via INNER JOIN.
-- If either parent record is missing, the INNER JOIN matches 0 rows and inserts nothing.
INSERT INTO enquiries (
    enquiry_reference,
    full_name,
    email,
    phone,
    city,
    service_course_id,
    preferred_branch_id,
    target_country,
    message,
    status,
    ip_address
)
SELECT 
    'DEMO-ENQ-2026-0001',
    'Test Candidate Alpha (Fictional)',
    'test.candidate.alpha@example.com',
    '+91-00000-00010',
    'Jalandhar',
    sc.id,
    b.id,
    'Canada',
    '[Sample Test Inquiry] Interested in weekend batch for IELTS Academic training.',
    'new',
    '127.0.0.1'
FROM services_courses sc
INNER JOIN branches b ON b.code = 'DEMO-BR-01'
WHERE sc.slug = 'ielts-academic-coaching'
  AND NOT EXISTS (
      SELECT 1 FROM enquiries WHERE enquiry_reference = 'DEMO-ENQ-2026-0001'
  );

-- Step 4.3: Insert Demo Enquiry 2 (Study Visa at Demo Branch 2)
-- Obtains parent IDs exclusively from verified rows via INNER JOIN.
-- If either parent record is missing, the INNER JOIN matches 0 rows and inserts nothing.
INSERT INTO enquiries (
    enquiry_reference,
    full_name,
    email,
    phone,
    city,
    service_course_id,
    preferred_branch_id,
    target_country,
    message,
    status,
    ip_address
)
SELECT 
    'DEMO-ENQ-2026-0002',
    'Test Candidate Beta (Fictional)',
    'test.candidate.beta@example.com',
    '+91-00000-00020',
    'Ludhiana',
    sc.id,
    b.id,
    'United Kingdom',
    '[Sample Test Inquiry] Seeking guidance for post-graduate study visa intake.',
    'in_progress',
    '127.0.0.1'
FROM services_courses sc
INNER JOIN branches b ON b.code = 'DEMO-BR-02'
WHERE sc.slug = 'study-visa-consultation'
  AND NOT EXISTS (
      SELECT 1 FROM enquiries WHERE enquiry_reference = 'DEMO-ENQ-2026-0002'
  );
