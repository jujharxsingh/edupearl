/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Services & Courses Controller (Milestone 5, Phase 3)
 * ============================================================================
 * 
 * Manages immigration visa consultation services and language proficiency courses.
 * 
 * Security & Access Rules:
 * 1. Public Read Access:
 *    - GET /api/services (returns active services/courses, supports ?category= and ?featured= filters)
 *    - GET /api/services/:id (returns active service or 404)
 *    - GET /api/services/slug/:slug (returns active service by URL slug or 404)
 * 2. Elevated Read Access:
 *    - ?includeInactive=true allows authenticated super_admin users to inspect
 *      deactivated records. Unauthenticated visitors and non-super-admin users
 *      are restricted to active records only.
 * 3. Write Operations (RBAC):
 *    - POST /api/services (create: super_admin, branch_admin)
 *    - PUT /api/services/:id (update: super_admin, branch_admin)
 *    - PATCH /api/services/:id/status (soft delete / toggle status: super_admin only)
 * 4. Soft-Deletion Policy:
 *    - Records are never permanently deleted (no DELETE endpoint).
 *    - Setting `is_active = FALSE` hides services from public visitors while
 *      preserving relational integrity for historical client enquiries.
 * 5. Parameterized SQL:
 *    - All database queries use parameterized inputs to prevent SQL injection.
 * ============================================================================
 */

const pool = require('../config/db');

const ALLOWED_CATEGORIES = ['immigration_service', 'language_course'];

/**
 * Converts text into a URL-friendly slug.
 * @param {string} text
 * @returns {string}
 */
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
};

/**
 * Validates service/course request body payload.
 * 
 * @param {object} body - Request body
 * @param {boolean} isUpdate - True if validating an update (PUT)
 * @returns {{ isValid: boolean, error?: string, sanitized?: object }}
 */
const validateServicePayload = (body, isUpdate = false) => {
  const sanitized = {};

  // 1. Title Validation
  if (!isUpdate || body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length < 2 || body.title.trim().length > 150) {
      return { isValid: false, error: 'Title is required and must be between 2 and 150 characters.' };
    }
    sanitized.title = body.title.trim();
  }

  // 2. Category Validation
  if (!isUpdate || body.category !== undefined) {
    if (!body.category || typeof body.category !== 'string' || !ALLOWED_CATEGORIES.includes(body.category.trim())) {
      return {
        isValid: false,
        error: 'Category is required and must be either "immigration_service" or "language_course".'
      };
    }
    sanitized.category = body.category.trim();
  }

  // 3. Slug Validation
  if (body.slug !== undefined && body.slug !== null && body.slug !== '') {
    if (typeof body.slug !== 'string') {
      return { isValid: false, error: 'Slug must be a string.' };
    }
    const trimmedSlug = body.slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug) || trimmedSlug.length < 2 || trimmedSlug.length > 100) {
      return {
        isValid: false,
        error: 'Slug must be between 2 and 100 lowercase alphanumeric characters and hyphens.'
      };
    }
    sanitized.slug = trimmedSlug;
  } else if (!isUpdate) {
    const generated = slugify(sanitized.title || '');
    if (!generated || generated.length < 2) {
      return { isValid: false, error: 'Unable to generate valid slug from title. Please provide an explicit slug.' };
    }
    sanitized.slug = generated;
  }

  // 4. Short Description Validation
  if (!isUpdate || body.short_description !== undefined) {
    if (typeof body.short_description !== 'string' || body.short_description.trim().length < 5 || body.short_description.trim().length > 300) {
      return {
        isValid: false,
        error: 'Short description is required and must be between 5 and 300 characters.'
      };
    }
    sanitized.short_description = body.short_description.trim();
  }

  // 5. Detailed Description (Optional)
  if (body.detailed_description !== undefined && body.detailed_description !== null) {
    if (typeof body.detailed_description !== 'string') {
      return { isValid: false, error: 'Detailed description must be a string.' };
    }
    const trimmed = body.detailed_description.trim();
    sanitized.detailed_description = trimmed.length > 0 ? trimmed : null;
  } else if (!isUpdate) {
    sanitized.detailed_description = null;
  }

  // 6. Duration Info (Optional)
  if (body.duration_info !== undefined && body.duration_info !== null) {
    if (typeof body.duration_info !== 'string') {
      return { isValid: false, error: 'Duration info must be a string.' };
    }
    const trimmed = body.duration_info.trim();
    if (trimmed.length > 100) {
      return { isValid: false, error: 'Duration info must not exceed 100 characters.' };
    }
    sanitized.duration_info = trimmed.length > 0 ? trimmed : null;
  } else if (!isUpdate) {
    sanitized.duration_info = null;
  }

  // 7. is_featured Validation (Optional, default false)
  if (body.is_featured !== undefined) {
    if (typeof body.is_featured !== 'boolean') {
      return { isValid: false, error: 'Field "is_featured" must be a boolean (true or false).' };
    }
    sanitized.is_featured = body.is_featured;
  } else if (!isUpdate) {
    sanitized.is_featured = false;
  }

  // 8. is_active Validation (Optional, default true)
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') {
      return { isValid: false, error: 'Field "is_active" must be a boolean (true or false).' };
    }
    sanitized.is_active = body.is_active;
  } else if (!isUpdate) {
    sanitized.is_active = true;
  }

  // 9. display_order Validation (Optional, default 0)
  if (body.display_order !== undefined) {
    const num = Number(body.display_order);
    if (!Number.isInteger(num)) {
      return { isValid: false, error: 'Field "display_order" must be an integer.' };
    }
    sanitized.display_order = num;
  } else if (!isUpdate) {
    sanitized.display_order = 0;
  }

  return { isValid: true, sanitized };
};

/**
 * Get all services and courses.
 * Route: GET /api/services
 * 
 * Supports query filters:
 *   ?category=immigration_service | language_course
 *   ?featured=true | false
 *   ?includeInactive=true (super_admin only)
 */
const getServices = async (req, res, next) => {
  try {
    const isSuperAdmin = req.admin && req.admin.role === 'super_admin';
    const canIncludeInactive = req.query.includeInactive === 'true' && isSuperAdmin;

    const conditions = [];
    const params = [];

    // Filter active records unless authorized super_admin requests inactive
    if (!canIncludeInactive) {
      conditions.push('is_active = TRUE');
    }

    // Category filter validation
    if (req.query.category) {
      if (!ALLOWED_CATEGORIES.includes(req.query.category)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid category filter. Allowed values: "immigration_service", "language_course".'
        });
      }
      conditions.push('category = ?');
      params.push(req.query.category);
    }

    // Featured filter validation
    if (req.query.featured !== undefined) {
      if (req.query.featured === 'true' || req.query.featured === '1') {
        conditions.push('is_featured = TRUE');
      } else if (req.query.featured === 'false' || req.query.featured === '0') {
        conditions.push('is_featured = FALSE');
      } else {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid featured filter. Allowed values: "true", "false".'
        });
      }
    }

    let query = `
      SELECT id, slug, category, title, short_description, detailed_description, duration_info, is_featured, is_active, display_order, created_at, updated_at
      FROM services_courses
    `;

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY display_order ASC, title ASC';

    const [rows] = await pool.query(query, params);

    res.status(200).json({
      status: 'success',
      count: rows.length,
      services: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get service or course by numeric ID.
 * Route: GET /api/services/:id
 */
const getServiceById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid service ID. Must be a positive integer.'
      });
    }

    const isSuperAdmin = req.admin && req.admin.role === 'super_admin';
    const canIncludeInactive = req.query.includeInactive === 'true' && isSuperAdmin;

    let query = `
      SELECT id, slug, category, title, short_description, detailed_description, duration_info, is_featured, is_active, display_order, created_at, updated_at
      FROM services_courses
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
        message: 'Service or course not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      service: rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get service or course by URL slug.
 * Route: GET /api/services/slug/:slug
 */
const getServiceBySlug = async (req, res, next) => {
  try {
    const rawSlug = req.params.slug;
    if (!rawSlug || typeof rawSlug !== 'string' || !/^[a-z0-9-]+$/.test(rawSlug.trim())) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid slug parameter format.'
      });
    }

    const slug = rawSlug.trim().toLowerCase();
    const isSuperAdmin = req.admin && req.admin.role === 'super_admin';
    const canIncludeInactive = req.query.includeInactive === 'true' && isSuperAdmin;

    let query = `
      SELECT id, slug, category, title, short_description, detailed_description, duration_info, is_featured, is_active, display_order, created_at, updated_at
      FROM services_courses
      WHERE slug = ?
    `;
    const params = [slug];

    if (!canIncludeInactive) {
      query += ' AND is_active = TRUE';
    }

    query += ' LIMIT 1';

    const [rows] = await pool.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Service or course not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      service: rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new service or course.
 * Route: POST /api/services
 * Access: super_admin, branch_admin
 */
const createService = async (req, res, next) => {
  try {
    const body = req.body || {};
    if (typeof body !== 'object' || Object.keys(body).length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body cannot be empty.'
      });
    }

    const validation = validateServicePayload(body, false);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: validation.error
      });
    }

    const {
      slug,
      category,
      title,
      short_description,
      detailed_description,
      duration_info,
      is_featured,
      is_active,
      display_order
    } = validation.sanitized;

    try {
      const [result] = await pool.query(
        `INSERT INTO services_courses (
          slug, category, title, short_description, detailed_description, duration_info, is_featured, is_active, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          slug,
          category,
          title,
          short_description,
          detailed_description,
          duration_info,
          is_featured,
          is_active,
          display_order
        ]
      );

      const [newRows] = await pool.query(
        `SELECT id, slug, category, title, short_description, detailed_description, duration_info, is_featured, is_active, display_order, created_at, updated_at
         FROM services_courses WHERE id = ?`,
        [result.insertId]
      );

      res.status(201).json({
        status: 'success',
        message: 'Service or course created successfully.',
        service: newRows[0]
      });
    } catch (dbError) {
      if (dbError.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          error: 'Conflict',
          message: `A service or course with slug "${slug}" already exists.`
        });
      }
      throw dbError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing service or course.
 * Route: PUT /api/services/:id
 * Access: super_admin, branch_admin
 */
const updateService = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid service ID. Must be a positive integer.'
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
      'SELECT id, slug, is_active FROM services_courses WHERE id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Service or course not found.'
      });
    }

    const validation = validateServicePayload(body, true);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: validation.error
      });
    }

    const current = existing[0];
    const slug = validation.sanitized.slug !== undefined ? validation.sanitized.slug : current.slug;
    const category = validation.sanitized.category;
    const title = validation.sanitized.title;
    const short_description = validation.sanitized.short_description;
    const detailed_description = validation.sanitized.detailed_description !== undefined ? validation.sanitized.detailed_description : null;
    const duration_info = validation.sanitized.duration_info !== undefined ? validation.sanitized.duration_info : null;
    const is_featured = validation.sanitized.is_featured !== undefined ? validation.sanitized.is_featured : false;
    const is_active = validation.sanitized.is_active !== undefined ? validation.sanitized.is_active : current.is_active;
    const display_order = validation.sanitized.display_order !== undefined ? validation.sanitized.display_order : 0;

    // Ensure all mandatory fields for full update are present
    if (!title || !category || !short_description) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Title, category, and short_description are required for service update.'
      });
    }

    try {
      await pool.query(
        `UPDATE services_courses SET
          slug = ?,
          category = ?,
          title = ?,
          short_description = ?,
          detailed_description = ?,
          duration_info = ?,
          is_featured = ?,
          is_active = ?,
          display_order = ?
         WHERE id = ?`,
        [
          slug,
          category,
          title,
          short_description,
          detailed_description,
          duration_info,
          is_featured,
          is_active,
          display_order,
          id
        ]
      );

      const [updatedRows] = await pool.query(
        `SELECT id, slug, category, title, short_description, detailed_description, duration_info, is_featured, is_active, display_order, created_at, updated_at
         FROM services_courses WHERE id = ?`,
        [id]
      );

      res.status(200).json({
        status: 'success',
        message: 'Service or course updated successfully.',
        service: updatedRows[0]
      });
    } catch (dbError) {
      if (dbError.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          error: 'Conflict',
          message: `A service or course with slug "${slug}" already exists.`
        });
      }
      throw dbError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle or set service/course active status (Soft-delete / Reactivate).
 * Route: PATCH /api/services/:id/status
 * Access: super_admin only
 */
const toggleServiceStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid service ID. Must be a positive integer.'
      });
    }

    const [existing] = await pool.query(
      'SELECT id, slug, title, is_active FROM services_courses WHERE id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Service or course not found.'
      });
    }

    const currentService = existing[0];
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
      targetStatus = !currentService.is_active;
    }

    await pool.query('UPDATE services_courses SET is_active = ? WHERE id = ?', [targetStatus, id]);

    const [updatedRows] = await pool.query(
      `SELECT id, slug, category, title, short_description, detailed_description, duration_info, is_featured, is_active, display_order, created_at, updated_at
       FROM services_courses WHERE id = ?`,
      [id]
    );

    res.status(200).json({
      status: 'success',
      message: targetStatus ? 'Service or course activated successfully.' : 'Service or course deactivated successfully.',
      service: updatedRows[0]
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getServices,
  getServiceById,
  getServiceBySlug,
  createService,
  updateService,
  toggleServiceStatus
};
