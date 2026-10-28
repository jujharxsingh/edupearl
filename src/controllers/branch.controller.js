/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Branch Controller (Milestone 5, Phase 2)
 * ============================================================================
 * 
 * Manages physical branch offices and language training centers.
 * 
 * Security & Access Rules:
 * 1. Public Read Access:
 *    - GET /api/branches (returns active branches by default)
 *    - GET /api/branches/:id (returns active branch or 404)
 * 2. Super Admin Read Access:
 *    - ?includeInactive=true allows authenticated super_admin users to inspect
 *      deactivated branches. Unauthenticated or non-super_admin users are
 *      restricted to active branches only.
 * 3. Super Admin Write Operations:
 *    - POST /api/branches (create branch)
 *    - PUT /api/branches/:id (update branch)
 *    - PATCH /api/branches/:id/status (soft delete / toggle status)
 * 4. Soft-Deletion Policy:
 *    - Branches are never permanently deleted (no DELETE endpoint).
 *    - Setting `is_active = FALSE` hides branches from public visitors while
 *      preserving relational integrity for historical client enquiries.
 * 5. Parameterized SQL:
 *    - All database queries use parameterized inputs to prevent SQL injection.
 * ============================================================================
 */

const pool = require('../config/db');

/**
 * Validates branch request body payload.
 * 
 * @param {object} body - Request body
 * @param {boolean} isUpdate - True if validating an update (PUT)
 * @returns {{ isValid: boolean, error?: string, sanitized?: object }}
 */
const validateBranchPayload = (body, isUpdate = false) => {
  const sanitized = {};

  // 1. Code Validation
  if (!isUpdate || body.code !== undefined) {
    if (typeof body.code !== 'string') {
      return { isValid: false, error: 'Branch code is required and must be a string.' };
    }
    const trimmedCode = body.code.trim().toUpperCase();
    if (!/^[A-Za-z0-9_-]{2,20}$/.test(trimmedCode)) {
      return {
        isValid: false,
        error: 'Branch code must be between 2 and 20 alphanumeric characters, hyphens, or underscores.'
      };
    }
    sanitized.code = trimmedCode;
  }

  // 2. Name Validation
  if (!isUpdate || body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 100) {
      return { isValid: false, error: 'Branch name is required and must be between 2 and 100 characters.' };
    }
    sanitized.name = body.name.trim();
  }

  // 3. Address Line 1 Validation
  if (!isUpdate || body.address_line1 !== undefined) {
    if (typeof body.address_line1 !== 'string' || body.address_line1.trim().length < 3 || body.address_line1.trim().length > 255) {
      return { isValid: false, error: 'Address line 1 is required and must be between 3 and 255 characters.' };
    }
    sanitized.address_line1 = body.address_line1.trim();
  }

  // 4. Address Line 2 (Optional)
  if (body.address_line2 !== undefined && body.address_line2 !== null) {
    if (typeof body.address_line2 !== 'string') {
      return { isValid: false, error: 'Address line 2 must be a string.' };
    }
    const trimmed = body.address_line2.trim();
    if (trimmed.length > 255) {
      return { isValid: false, error: 'Address line 2 must not exceed 255 characters.' };
    }
    sanitized.address_line2 = trimmed.length > 0 ? trimmed : null;
  } else if (!isUpdate) {
    sanitized.address_line2 = null;
  }

  // 5. City Validation
  if (!isUpdate || body.city !== undefined) {
    if (typeof body.city !== 'string' || body.city.trim().length < 2 || body.city.trim().length > 100) {
      return { isValid: false, error: 'City is required and must be between 2 and 100 characters.' };
    }
    sanitized.city = body.city.trim();
  }

  // 6. State Validation
  if (!isUpdate || body.state !== undefined) {
    if (typeof body.state !== 'string' || body.state.trim().length < 2 || body.state.trim().length > 100) {
      return { isValid: false, error: 'State is required and must be between 2 and 100 characters.' };
    }
    sanitized.state = body.state.trim();
  }

  // 7. Postal Code Validation
  if (!isUpdate || body.postal_code !== undefined) {
    if (typeof body.postal_code !== 'string') {
      return { isValid: false, error: 'Postal code is required and must be a string.' };
    }
    const trimmedPostal = body.postal_code.trim();
    if (!/^[A-Za-z0-9\s-]{3,20}$/.test(trimmedPostal)) {
      return { isValid: false, error: 'Postal code must be between 3 and 20 alphanumeric characters.' };
    }
    sanitized.postal_code = trimmedPostal;
  }

  // 8. Country Validation (Optional, default 'India')
  if (body.country !== undefined && body.country !== null) {
    if (typeof body.country !== 'string' || body.country.trim().length === 0 || body.country.trim().length > 100) {
      return { isValid: false, error: 'Country must be a string up to 100 characters.' };
    }
    sanitized.country = body.country.trim();
  } else if (!isUpdate) {
    sanitized.country = 'India';
  }

  // 9. Phone Validation (Optional)
  if (body.phone !== undefined && body.phone !== null && body.phone !== '') {
    if (typeof body.phone !== 'string') {
      return { isValid: false, error: 'Phone must be a string.' };
    }
    const trimmedPhone = body.phone.trim();
    if (!/^[+0-9\s-()]{6,30}$/.test(trimmedPhone)) {
      return { isValid: false, error: 'Phone number format is invalid. Must be between 6 and 30 characters.' };
    }
    sanitized.phone = trimmedPhone;
  } else if (!isUpdate || body.phone === '' || body.phone === null) {
    sanitized.phone = null;
  }

  // 10. Email Validation (Optional)
  if (body.email !== undefined && body.email !== null && body.email !== '') {
    if (typeof body.email !== 'string') {
      return { isValid: false, error: 'Email must be a string.' };
    }
    const trimmedEmail = body.email.trim();
    if (trimmedEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return { isValid: false, error: 'Email address format is invalid.' };
    }
    sanitized.email = trimmedEmail;
  } else if (!isUpdate || body.email === '' || body.email === null) {
    sanitized.email = null;
  }

  // 11. is_active Validation (Optional)
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') {
      return { isValid: false, error: 'Field "is_active" must be a boolean (true or false).' };
    }
    sanitized.is_active = body.is_active;
  } else if (!isUpdate) {
    sanitized.is_active = true;
  }

  return { isValid: true, sanitized };
};

/**
 * Get all branches.
 * Route: GET /api/branches
 * 
 * Public visitors receive active branches only.
 * Authenticated super_admin can query ?includeInactive=true to inspect all branches.
 */
const getBranches = async (req, res, next) => {
  try {
    const isSuperAdmin = req.admin && req.admin.role === 'super_admin';
    const canIncludeInactive = req.query.includeInactive === 'true' && isSuperAdmin;

    let query = `
      SELECT id, code, name, address_line1, address_line2, city, state, postal_code, country, phone, email, is_active, created_at, updated_at
      FROM branches
    `;

    if (!canIncludeInactive) {
      query += ' WHERE is_active = TRUE';
    }

    query += ' ORDER BY name ASC';

    const [rows] = await pool.query(query);

    res.status(200).json({
      status: 'success',
      count: rows.length,
      branches: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get branch by ID.
 * Route: GET /api/branches/:id
 * 
 * Public visitors receive active branch or 404.
 * Authenticated super_admin can query ?includeInactive=true to retrieve inactive branch.
 */
const getBranchById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid branch ID. Must be a positive integer.'
      });
    }

    const isSuperAdmin = req.admin && req.admin.role === 'super_admin';
    const canIncludeInactive = req.query.includeInactive === 'true' && isSuperAdmin;

    let query = `
      SELECT id, code, name, address_line1, address_line2, city, state, postal_code, country, phone, email, is_active, created_at, updated_at
      FROM branches
      WHERE id = ?
    `;
    const params = [id];

    if (!canIncludeInactive) {
      query += ' AND is_active = TRUE';
    }

    query += ' LIMIT 1';

    const [rows] = await pool.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Branch not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      branch: rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new branch.
 * Route: POST /api/branches
 * Access: Super Admin only
 */
const createBranch = async (req, res, next) => {
  try {
    const body = req.body || {};
    if (typeof body !== 'object' || Object.keys(body).length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body cannot be empty.'
      });
    }

    const validation = validateBranchPayload(body, false);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: validation.error
      });
    }

    const {
      code,
      name,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      phone,
      email,
      is_active
    } = validation.sanitized;

    try {
      const [result] = await pool.query(
        `INSERT INTO branches (
          code, name, address_line1, address_line2, city, state, postal_code, country, phone, email, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          code,
          name,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          phone,
          email,
          is_active
        ]
      );

      const [newRows] = await pool.query(
        `SELECT id, code, name, address_line1, address_line2, city, state, postal_code, country, phone, email, is_active, created_at, updated_at
         FROM branches WHERE id = ?`,
        [result.insertId]
      );

      res.status(201).json({
        status: 'success',
        message: 'Branch created successfully.',
        branch: newRows[0]
      });
    } catch (dbError) {
      if (dbError.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          error: 'Conflict',
          message: `A branch with code "${code}" already exists.`
        });
      }
      throw dbError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing branch.
 * Route: PUT /api/branches/:id
 * Access: Super Admin only
 */
const updateBranch = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid branch ID. Must be a positive integer.'
      });
    }

    const body = req.body || {};
    if (typeof body !== 'object' || Object.keys(body).length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body cannot be empty.'
      });
    }

    // Verify record exists before updating
    const [existing] = await pool.query(
      'SELECT id, code, is_active FROM branches WHERE id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Branch not found.'
      });
    }

    const validation = validateBranchPayload(body, true);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: validation.error
      });
    }

    const current = existing[0];
    const code = validation.sanitized.code !== undefined ? validation.sanitized.code : current.code;
    const name = validation.sanitized.name;
    const address_line1 = validation.sanitized.address_line1;
    const address_line2 = validation.sanitized.address_line2 !== undefined ? validation.sanitized.address_line2 : null;
    const city = validation.sanitized.city;
    const state = validation.sanitized.state;
    const postal_code = validation.sanitized.postal_code;
    const country = validation.sanitized.country !== undefined ? validation.sanitized.country : 'India';
    const phone = validation.sanitized.phone !== undefined ? validation.sanitized.phone : null;
    const email = validation.sanitized.email !== undefined ? validation.sanitized.email : null;
    const is_active = validation.sanitized.is_active !== undefined ? validation.sanitized.is_active : current.is_active;

    // Ensure all mandatory fields for full update are present
    if (!name || !address_line1 || !city || !state || !postal_code) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Name, address_line1, city, state, and postal_code are required for branch update.'
      });
    }

    try {
      await pool.query(
        `UPDATE branches SET
          code = ?,
          name = ?,
          address_line1 = ?,
          address_line2 = ?,
          city = ?,
          state = ?,
          postal_code = ?,
          country = ?,
          phone = ?,
          email = ?,
          is_active = ?
         WHERE id = ?`,
        [
          code,
          name,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          phone,
          email,
          is_active,
          id
        ]
      );

      const [updatedRows] = await pool.query(
        `SELECT id, code, name, address_line1, address_line2, city, state, postal_code, country, phone, email, is_active, created_at, updated_at
         FROM branches WHERE id = ?`,
        [id]
      );

      res.status(200).json({
        status: 'success',
        message: 'Branch updated successfully.',
        branch: updatedRows[0]
      });
    } catch (dbError) {
      if (dbError.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          error: 'Conflict',
          message: `A branch with code "${code}" already exists.`
        });
      }
      throw dbError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle or set branch active status (Soft-delete / Reactivate).
 * Route: PATCH /api/branches/:id/status
 * Access: Super Admin only
 */
const toggleBranchStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid branch ID. Must be a positive integer.'
      });
    }

    const [existing] = await pool.query(
      'SELECT id, code, name, is_active FROM branches WHERE id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Branch not found.'
      });
    }

    const currentBranch = existing[0];
    const body = req.body || {};

    let targetStatus;
    if (typeof body.is_active === 'boolean') {
      targetStatus = body.is_active;
    } else if (body.is_active !== undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Field "is_active" must be a boolean (true or false).'
      });
    } else {
      // Toggle current status if body is empty or is_active not specified
      targetStatus = !currentBranch.is_active;
    }

    await pool.query('UPDATE branches SET is_active = ? WHERE id = ?', [targetStatus, id]);

    const [updatedRows] = await pool.query(
      `SELECT id, code, name, address_line1, address_line2, city, state, postal_code, country, phone, email, is_active, created_at, updated_at
       FROM branches WHERE id = ?`,
      [id]
    );

    res.status(200).json({
      status: 'success',
      message: targetStatus ? 'Branch activated successfully.' : 'Branch deactivated successfully.',
      branch: updatedRows[0]
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBranches,
  getBranchById,
  createBranch,
  updateBranch,
  toggleBranchStatus
};
