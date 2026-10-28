-- ============================================================================
-- Edu Pearl Immigration Services & Language Point
-- Database Schema Definition (Milestone 2)
-- ============================================================================
-- Compatible with: MySQL 8.0+
-- Default Charset: utf8mb4 (Full Unicode support including multilingual characters)
-- Collation:       utf8mb4_unicode_ci
-- Re-run Safety:   Safe to re-run. Uses CREATE TABLE IF NOT EXISTS.
--                  No existing data or tables are dropped or destroyed.
-- ============================================================================

USE edupearl_db;

-- ----------------------------------------------------------------------------
-- Table 1: admins
-- Purpose: Stores authorized staff/administrators who log into the management
--          portal. Passwords MUST be stored as salted one-way cryptographic 
--          hashes (e.g. bcrypt/argon2), NEVER in plaintext.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL COMMENT 'Salted bcrypt/argon2 hash. NEVER store plaintext.',
    full_name VARCHAR(100) NOT NULL,
    role ENUM('super_admin', 'branch_admin', 'counselor') NOT NULL DEFAULT 'super_admin',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at DATETIME NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints & Indexes
    CONSTRAINT uq_admins_username UNIQUE (username),
    CONSTRAINT uq_admins_email UNIQUE (email),
    INDEX idx_admins_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
-- Table 2: branches
-- Purpose: Represents physical branch offices and language training centers.
--          Enquiries reference a branch to indicate where the client wishes
--          to attend counseling or classes.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL COMMENT 'Unique short identifier, e.g. BR-JAL-01',
    name VARCHAR(100) NOT NULL COMMENT 'Branch name, e.g. Model Town Training Center',
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

    -- Constraints & Indexes
    CONSTRAINT uq_branches_code UNIQUE (code),
    INDEX idx_branches_city (city),
    INDEX idx_branches_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
-- Table 3: services_courses
-- Purpose: Stores immigration visa consultation offerings (Study, Tourist, PR)
--          and language proficiency preparation courses (IELTS, PTE, Spoken English).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services_courses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(100) NOT NULL COMMENT 'URL-safe unique identifier for routing and SEO',
    category ENUM('immigration_service', 'language_course') NOT NULL,
    title VARCHAR(150) NOT NULL,
    short_description VARCHAR(300) NOT NULL,
    detailed_description TEXT NULL,
    duration_info VARCHAR(100) NULL COMMENT 'E.g., 8 Weeks, Ongoing Consultation',
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints & Indexes
    CONSTRAINT uq_services_courses_slug UNIQUE (slug),
    INDEX idx_services_category (category),
    INDEX idx_services_is_active (is_active),
    INDEX idx_services_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
-- Table 4: enquiries
-- Purpose: Captures customer/student leads submitted via website contact forms.
--          Tracks lead status, preferred service/course, and assigned branch.
--          If a branch or service is deleted, ON DELETE SET NULL ensures lead
--          history and client records are preserved.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enquiries (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    enquiry_reference VARCHAR(30) NOT NULL COMMENT 'Unique reference tracking code, e.g. ENQ-2026-0001',
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    city VARCHAR(100) NULL,
    service_course_id INT UNSIGNED NULL DEFAULT NULL,
    preferred_branch_id INT UNSIGNED NULL DEFAULT NULL,
    target_country VARCHAR(100) NULL COMMENT 'Canada, UK, Australia, etc. (for visa seekers)',
    message TEXT NULL,
    status ENUM('new', 'in_progress', 'contacted', 'closed', 'converted') NOT NULL DEFAULT 'new',
    counselor_notes TEXT NULL,
    ip_address VARCHAR(45) NULL COMMENT 'For rate-limiting and abuse monitoring (supports IPv4 & IPv6)',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Constraints & Foreign Keys
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

    -- Performance Indexes
    INDEX idx_enquiries_status (status),
    INDEX idx_enquiries_created_at (created_at),
    INDEX idx_enquiries_email (email),
    INDEX idx_enquiries_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
