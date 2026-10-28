/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Enquiries Controller (Milestone 5, Phase 4)
 * ============================================================================
 * 
 * Manages client/student prospective leads submitted via public contact forms.
 * 
 * Security & Access Rules:
 * 1. Public Submission:
 *    - POST /api/enquiries (protected by enquirySubmissionLimiter + honeypot)
 * 2. Administrative Listing & Retrieval:
 *    - GET /api/enquiries (super_admin, branch_admin, counselor)
 *    - GET /api/enquiries/:id (super_admin, branch_admin, counselor)
 *    - GET /api/enquiries/reference/:reference (super_admin, branch_admin, counselor)
 * 3. Status & Notes Progression:
 *    - PATCH /api/enquiries/:id/status (super_admin, branch_admin, counselor)
 * 4. Branch Reassignment:
 *    - PATCH /api/enquiries/:id/branch (super_admin, branch_admin only; counselor blocked)
 * 5. Data Privacy & Zero-Deletion:
 *    - IP addresses are recorded for security monitoring but omitted from ordinary API responses.
 *    - No permanent DELETE endpoints exist. Leads are closed via status transition ('closed').
 * 6. Parameterized SQL:
 *    - All database queries strictly use parameterized queries to prevent SQL injection.
 * ============================================================================
 */

const crypto = require('crypto');
const pool = require('../config/db');

const ALLOWED_STATUSES = ['new', 'in_progress', 'contacted', 'closed', 'converted'];

/**
 * Public Enquiry Submission Handler.
 * Route: POST /api/enquiries
 * Access: Public (rate limited)
 */
const createEnquiry = async (req, res, next) => {
  try {
    const body = req.body || {};

    // 1. Honeypot Anti-Spam Protection
    // Automated spambots fill all form fields. If hidden honeypot fields are populated,
    // silently return a synthetic 201 response without persisting lead to database.
    const honeypot = body._hp || body.website_url || body._gotcha;
    if (honeypot && String(honeypot).trim().length > 0) {
      return res.status(201).json({
        status: 'success',
        message: 'Enquiry submitted successfully. A counselor will contact you shortly.',
        enquiry: {
          enquiry_reference: `ENQ-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
        }
      });
    }

    // 2. Full Name Validation
    if (typeof body.full_name !== 'string' || body.full_name.trim().length < 2 || body.full_name.trim().length > 100) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Full name is required and must be between 2 and 100 characters.'
      });
    }
    const fullName = body.full_name.trim();

    // 3. Email Validation
    if (typeof body.email !== 'string' || body.email.trim().length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Valid email address is required and must not exceed 100 characters.'
      });
    }
    const email = body.email.trim();

    // 4. Phone Validation
    if (typeof body.phone !== 'string' || body.phone.trim().length < 6 || body.phone.trim().length > 30 || !/^[+0-9\s-()]{6,30}$/.test(body.phone.trim())) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Valid phone number is required (between 6 and 30 characters).'
      });
    }
    const phone = body.phone.trim();

    // 5. City Validation (Optional)
    let city = null;
    if (body.city !== undefined && body.city !== null && body.city !== '') {
      if (typeof body.city !== 'string' || body.city.trim().length > 100) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'City must not exceed 100 characters.'
        });
      }
      city = body.city.trim();
    }

    // 6. Target Country Validation (Optional)
    let targetCountry = null;
    if (body.target_country !== undefined && body.target_country !== null && body.target_country !== '') {
      if (typeof body.target_country !== 'string' || body.target_country.trim().length > 100) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Target country must not exceed 100 characters.'
        });
      }
      targetCountry = body.target_country.trim();
    }

    // 7. Message Validation (Optional)
    let message = null;
    if (body.message !== undefined && body.message !== null && body.message !== '') {
      if (typeof body.message !== 'string' || body.message.trim().length > 2000) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Message must not exceed 2000 characters.'
        });
      }
      message = body.message.trim();
    }

    // 8. Preferred Branch Validation (Optional Foreign Key)
    let preferredBranchId = null;
    if (body.preferred_branch_id !== undefined && body.preferred_branch_id !== null && body.preferred_branch_id !== '') {
      const branchId = parseInt(body.preferred_branch_id, 10);
      if (!Number.isInteger(branchId) || branchId <= 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid preferred_branch_id. Must be a positive integer.'
        });
      }

      // Verify referenced branch exists and is active
      const [branchRows] = await pool.query(
        'SELECT id, is_active FROM branches WHERE id = ? LIMIT 1',
        [branchId]
      );

      if (branchRows.length === 0 || !branchRows[0].is_active) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid preferred_branch_id. Selected branch does not exist or is inactive.'
        });
      }
      preferredBranchId = branchId;
    }

    // 9. Service / Course Validation (Optional Foreign Key)
    let serviceCourseId = null;
    if (body.service_course_id !== undefined && body.service_course_id !== null && body.service_course_id !== '') {
      const serviceId = parseInt(body.service_course_id, 10);
      if (!Number.isInteger(serviceId) || serviceId <= 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid service_course_id. Must be a positive integer.'
        });
      }

      // Verify referenced service/course exists and is active
      const [serviceRows] = await pool.query(
        'SELECT id, is_active FROM services_courses WHERE id = ? LIMIT 1',
        [serviceId]
      );

      if (serviceRows.length === 0 || !serviceRows[0].is_active) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid service_course_id. Selected service or course does not exist or is inactive.'
        });
      }
      serviceCourseId = serviceId;
    }

    // 10. Capture Client IP safely (Direct socket address, truncated to 45 chars for IPv6 support)
    const clientIp = (req.ip || req.socket?.remoteAddress || '').slice(0, 45) || null;

    // 11. Generate Unique Enquiry Reference Code (e.g. ENQ-2026-F9A1B2)
    const currentYear = new Date().getFullYear();
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const enquiryReference = `ENQ-${currentYear}-${randomHex}`;

    // 12. Insert Enquiry Record
    const [result] = await pool.query(
      `INSERT INTO enquiries (
        enquiry_reference, full_name, email, phone, city,
        service_course_id, preferred_branch_id, target_country,
        message, status, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
      [
        enquiryReference,
        fullName,
        email,
        phone,
        city,
        serviceCourseId,
        preferredBranchId,
        targetCountry,
        message,
        clientIp
      ]
    );

    // Fetch and return created enquiry without exposing internal IP
    const [newRows] = await pool.query(
      `SELECT 
        e.id, e.enquiry_reference, e.full_name, e.email, e.phone, e.city,
        e.service_course_id, sc.title AS service_title, sc.category AS service_category,
        e.preferred_branch_id, b.name AS branch_name, b.code AS branch_code,
        e.target_country, e.message, e.status, e.created_at
       FROM enquiries e
       LEFT JOIN branches b ON e.preferred_branch_id = b.id
       LEFT JOIN services_courses sc ON e.service_course_id = sc.id
       WHERE e.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      status: 'success',
      message: 'Enquiry submitted successfully. A counselor will contact you shortly.',
      enquiry: newRows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List Enquiries with Pagination and Filtering.
 * Route: GET /api/enquiries
 * Access: super_admin, branch_admin, counselor
 */
const getEnquiries = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    // Filter: Status
    if (req.query.status) {
      if (!ALLOWED_STATUSES.includes(req.query.status)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid status filter. Allowed values: ${ALLOWED_STATUSES.join(', ')}.`
        });
      }
      conditions.push('e.status = ?');
      params.push(req.query.status);
    }

    // Filter: Branch ID
    if (req.query.branchId) {
      const bId = parseInt(req.query.branchId, 10);
      if (!Number.isInteger(bId) || bId <= 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Query parameter "branchId" must be a positive integer.'
        });
      }
      conditions.push('e.preferred_branch_id = ?');
      params.push(bId);
    }

    // Filter: Service ID
    if (req.query.serviceId) {
      const sId = parseInt(req.query.serviceId, 10);
      if (!Number.isInteger(sId) || sId <= 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Query parameter "serviceId" must be a positive integer.'
        });
      }
      conditions.push('e.service_course_id = ?');
      params.push(sId);
    }

    // Filter: Search Keyword (Name, Email, Phone, Reference)
    if (req.query.search) {
      const search = String(req.query.search).trim();
      if (search.length > 0) {
        conditions.push('(e.full_name LIKE ? OR e.email LIKE ? OR e.phone LIKE ? OR e.enquiry_reference LIKE ?)');
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }
    }

    // Filter: Date Range
    if (req.query.dateFrom) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.dateFrom)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Query parameter "dateFrom" must be in YYYY-MM-DD format.'
        });
      }
      conditions.push('e.created_at >= ?');
      params.push(`${req.query.dateFrom} 00:00:00`);
    }

    if (req.query.dateTo) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.dateTo)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Query parameter "dateTo" must be in YYYY-MM-DD format.'
        });
      }
      conditions.push('e.created_at <= ?');
      params.push(`${req.query.dateTo} 23:59:59`);
    }

    // Sorting Validation
    const allowedSortFields = {
      created_at: 'e.created_at',
      status: 'e.status',
      id: 'e.id'
    };
    const sortBy = allowedSortFields[req.query.sortBy] || 'e.created_at';
    const sortOrder = req.query.sortOrder && req.query.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Total Count Query
    const countSql = `SELECT COUNT(*) AS total FROM enquiries e ${whereClause}`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0].total;

    // 2. Data Retrieval Query
    const dataSql = `
      SELECT 
        e.id, e.enquiry_reference, e.full_name, e.email, e.phone, e.city,
        e.service_course_id, sc.title AS service_title, sc.category AS service_category,
        e.preferred_branch_id, b.name AS branch_name, b.code AS branch_code,
        e.target_country, e.message, e.status, e.counselor_notes,
        e.created_at, e.updated_at
      FROM enquiries e
      LEFT JOIN branches b ON e.preferred_branch_id = b.id
      LEFT JOIN services_courses sc ON e.service_course_id = sc.id
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const [rows] = await pool.query(dataSql, dataParams);

    res.status(200).json({
      status: 'success',
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      },
      enquiries: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Enquiry by Numeric ID.
 * Route: GET /api/enquiries/:id
 * Access: super_admin, branch_admin, counselor
 */
const getEnquiryById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid enquiry ID. Must be a positive integer.'
      });
    }

    const [rows] = await pool.query(
      `SELECT 
        e.id, e.enquiry_reference, e.full_name, e.email, e.phone, e.city,
        e.service_course_id, sc.title AS service_title, sc.category AS service_category,
        e.preferred_branch_id, b.name AS branch_name, b.code AS branch_code,
        e.target_country, e.message, e.status, e.counselor_notes,
        e.created_at, e.updated_at
       FROM enquiries e
       LEFT JOIN branches b ON e.preferred_branch_id = b.id
       LEFT JOIN services_courses sc ON e.service_course_id = sc.id
       WHERE e.id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Enquiry not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      enquiry: rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Enquiry by Reference Code.
 * Route: GET /api/enquiries/reference/:reference
 * Access: super_admin, branch_admin, counselor
 */
const getEnquiryByReference = async (req, res, next) => {
  try {
    const reference = String(req.params.reference || '').trim();
    if (!/^[A-Za-z0-9_-]{2,30}$/.test(reference)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid enquiry reference format.'
      });
    }

    const [rows] = await pool.query(
      `SELECT 
        e.id, e.enquiry_reference, e.full_name, e.email, e.phone, e.city,
        e.service_course_id, sc.title AS service_title, sc.category AS service_category,
        e.preferred_branch_id, b.name AS branch_name, b.code AS branch_code,
        e.target_country, e.message, e.status, e.counselor_notes,
        e.created_at, e.updated_at
       FROM enquiries e
       LEFT JOIN branches b ON e.preferred_branch_id = b.id
       LEFT JOIN services_courses sc ON e.service_course_id = sc.id
       WHERE e.enquiry_reference = ?
       LIMIT 1`,
      [reference]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Enquiry not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      enquiry: rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Enquiry Status and/or Counselor Notes.
 * Route: PATCH /api/enquiries/:id/status
 * Access: super_admin, branch_admin, counselor
 */
const updateEnquiryStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid enquiry ID. Must be a positive integer.'
      });
    }

    const body = req.body || {};
    if (body.status === undefined && body.counselor_notes === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'At least one of "status" or "counselor_notes" must be provided.'
      });
    }

    // Verify enquiry exists
    const [existing] = await pool.query(
      'SELECT id, status, counselor_notes FROM enquiries WHERE id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Enquiry not found.'
      });
    }

    const current = existing[0];
    let newStatus = current.status;
    let newNotes = current.counselor_notes;

    if (body.status !== undefined) {
      if (!ALLOWED_STATUSES.includes(body.status)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}.`
        });
      }
      newStatus = body.status;
    }

    if (body.counselor_notes !== undefined) {
      if (body.counselor_notes !== null && typeof body.counselor_notes !== 'string') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Counselor notes must be a string.'
        });
      }
      if (body.counselor_notes && body.counselor_notes.trim().length > 5000) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Counselor notes must not exceed 5000 characters.'
        });
      }
      newNotes = body.counselor_notes ? body.counselor_notes.trim() : null;
    }

    await pool.query(
      'UPDATE enquiries SET status = ?, counselor_notes = ? WHERE id = ?',
      [newStatus, newNotes, id]
    );

    const [updatedRows] = await pool.query(
      `SELECT 
        e.id, e.enquiry_reference, e.full_name, e.email, e.phone, e.city,
        e.service_course_id, sc.title AS service_title, sc.category AS service_category,
        e.preferred_branch_id, b.name AS branch_name, b.code AS branch_code,
        e.target_country, e.message, e.status, e.counselor_notes,
        e.created_at, e.updated_at
       FROM enquiries e
       LEFT JOIN branches b ON e.preferred_branch_id = b.id
       LEFT JOIN services_courses sc ON e.service_course_id = sc.id
       WHERE e.id = ?`,
      [id]
    );

    res.status(200).json({
      status: 'success',
      message: 'Enquiry status updated successfully.',
      enquiry: updatedRows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reassign Preferred Branch for Enquiry.
 * Route: PATCH /api/enquiries/:id/branch
 * Access: super_admin, branch_admin (counselor denied)
 */
const reassignEnquiryBranch = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid enquiry ID. Must be a positive integer.'
      });
    }

    const body = req.body || {};
    if (body.preferred_branch_id === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Field "preferred_branch_id" is required.'
      });
    }

    // Verify enquiry exists
    const [existing] = await pool.query(
      'SELECT id, preferred_branch_id FROM enquiries WHERE id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Enquiry not found.'
      });
    }

    let targetBranchId = null;
    if (body.preferred_branch_id !== null) {
      targetBranchId = parseInt(body.preferred_branch_id, 10);
      if (!Number.isInteger(targetBranchId) || targetBranchId <= 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Field "preferred_branch_id" must be a positive integer or null.'
        });
      }

      // Verify branch exists and is active
      const [branchRows] = await pool.query(
        'SELECT id, is_active FROM branches WHERE id = ? LIMIT 1',
        [targetBranchId]
      );

      if (branchRows.length === 0 || !branchRows[0].is_active) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Selected branch does not exist or is inactive.'
        });
      }
    }

    await pool.query(
      'UPDATE enquiries SET preferred_branch_id = ? WHERE id = ?',
      [targetBranchId, id]
    );

    const [updatedRows] = await pool.query(
      `SELECT 
        e.id, e.enquiry_reference, e.full_name, e.email, e.phone, e.city,
        e.service_course_id, sc.title AS service_title, sc.category AS service_category,
        e.preferred_branch_id, b.name AS branch_name, b.code AS branch_code,
        e.target_country, e.message, e.status, e.counselor_notes,
        e.created_at, e.updated_at
       FROM enquiries e
       LEFT JOIN branches b ON e.preferred_branch_id = b.id
       LEFT JOIN services_courses sc ON e.service_course_id = sc.id
       WHERE e.id = ?`,
      [id]
    );

    res.status(200).json({
      status: 'success',
      message: 'Enquiry branch reassigned successfully.',
      enquiry: updatedRows[0]
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
  getEnquiryByReference,
  updateEnquiryStatus,
  reassignEnquiryBranch
};
