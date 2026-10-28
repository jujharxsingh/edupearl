/**
 * ============================================================================
 * Edupearl Immigration Services and Language Point
 * Centralized Admin API Client (Phase 1: Foundation)
 * ============================================================================
 * 
 * Provides beginner-friendly asynchronous fetch wrappers for administrative
 * endpoints.
 * 
 * Security Principles:
 * 1. Uses same-origin requests with `credentials: 'same-origin'`.
 * 2. Never reads, parses, or stores raw JWTs in client-side storage (localStorage / sessionStorage).
 * 3. Safely handles JSON and non-JSON server error responses.
 * 4. Transparently intercepts 401 Unauthorized on protected routes to clear local
 *    state and navigate to the login page, while avoiding redirect loops on login.
 * ============================================================================
 */

const adminApi = {
  /**
   * Core HTTP Fetch Wrapper
   * 
   * @param {string} endpoint - API route (e.g. '/api/admin/me')
   * @param {object} options - Fetch options (method, headers, body, skipAuthRedirect)
   * @returns {Promise<object>} Parsed JSON response
   */
  async request(endpoint, options = {}) {
    const config = {
      method: options.method || 'GET',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    };

    if (options.body && typeof options.body === 'object') {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(options.body);
    } else if (options.body) {
      config.body = options.body;
    }

    try {
      const response = await fetch(endpoint, config);

      // Safe JSON parsing handling both JSON and non-JSON bodies
      let data = {};
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json().catch(() => ({}));
      } else {
        const text = await response.text().catch(() => '');
        if (text) {
          data = { message: text };
        }
      }

      if (!response.ok) {
        // Construct standard error object
        const error = new Error(
          data.message || data.error || `Request failed with HTTP status ${response.status}`
        );
        error.status = response.status;
        error.data = data;

        // Auto-handle 401 Unauthorized on protected resources
        // Do NOT auto-redirect if skipAuthRedirect is set, or if this is the login endpoint itself
        if (
          response.status === 401 &&
          !options.skipAuthRedirect &&
          endpoint !== '/api/auth/login'
        ) {
          if (typeof window !== 'undefined' && window.location) {
            const currentPath = window.location.pathname;
            if (!currentPath.includes('/admin/login.html')) {
              const redirectParam = encodeURIComponent(currentPath + window.location.search);
              window.location.href = `/admin/login.html?redirect=${redirectParam}`;
            }
          }
        }

        throw error;
      }

      return data;
    } catch (err) {
      if (!err.status) {
        // Network failure / server unreachable
        const netErr = new Error('Unable to connect to the server. Please check your network connection.');
        netErr.status = 0;
        netErr.originalError = err;
        throw netErr;
      }
      throw err;
    }
  },

  /**
   * Authenticate administrator
   * Route: POST /api/auth/login
   * 
   * @param {string} identifier - Username or Email
   * @param {string} password - Password
   * @returns {Promise<object>}
   */
  async login(identifier, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: {
        identifier: identifier.trim(),
        password: password
      },
      skipAuthRedirect: true // Let login page render failure messages
    });
  },

  /**
   * Terminate administrator session
   * Route: POST /api/auth/logout
   * 
   * @returns {Promise<object>}
   */
  async logout() {
    return this.request('/api/auth/logout', {
      method: 'POST',
      skipAuthRedirect: true
    });
  },

  /**
   * Retrieve current administrator identity & role
   * Route: GET /api/admin/me
   * 
   * @param {boolean} skipRedirect - If true, suppresses automatic login redirect on 401
   * @returns {Promise<object>}
   */
  async getMe(skipRedirect = false) {
    return this.request('/api/admin/me', {
      method: 'GET',
      skipAuthRedirect: skipRedirect
    });
  },

  /**
   * Check API Health
   * Route: GET /api/health
   */
  async getHealth() {
    return this.request('/api/health', { method: 'GET', skipAuthRedirect: true });
  },

  /**
   * Check Database Health
   * Route: GET /api/health/db
   */
  async getDbHealth() {
    return this.request('/api/health/db', { method: 'GET', skipAuthRedirect: true });
  },

  /**
   * Fetch Enquiries with query filters & pagination
   * Route: GET /api/enquiries
   * 
   * @param {object} params - Query filters { page, limit, status, branchId, serviceId, search, dateFrom, dateTo, sortBy, sortOrder }
   * @returns {Promise<object>} { status, pagination: { page, limit, total, totalPages }, enquiries }
   */
  async getEnquiries(params = {}) {
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        qs.append(key, String(val));
      }
    }
    const query = qs.toString();
    return this.request(`/api/enquiries${query ? `?${query}` : ''}`);
  },

  /**
   * Fetch Services and Courses
   * Route: GET /api/services
   * 
   * @param {object} params - Query filters { category, featured, includeInactive }
   * @returns {Promise<object>} { status, count, services }
   */
  async getServices(params = {}) {
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        qs.append(key, String(val));
      }
    }
    const query = qs.toString();
    return this.request(`/api/services${query ? `?${query}` : ''}`);
  },

  /**
   * Fetch Single Service / Course by Numeric ID
   * Route: GET /api/services/:id
   * 
   * @param {number|string} id - Service ID
   * @param {boolean} includeInactive - Include inactive records (super_admin only)
   * @returns {Promise<object>} { status: 'success', service }
   */
  async getServiceById(id, includeInactive = false) {
    const qs = includeInactive ? '?includeInactive=true' : '';
    return this.request(`/api/services/${encodeURIComponent(id)}${qs}`);
  },

  /**
   * Fetch Single Service / Course by URL Slug
   * Route: GET /api/services/slug/:slug
   * 
   * @param {string} slug - Unique URL slug
   * @param {boolean} includeInactive - Include inactive records (super_admin only)
   * @returns {Promise<object>} { status: 'success', service }
   */
  async getServiceBySlug(slug, includeInactive = false) {
    const qs = includeInactive ? '?includeInactive=true' : '';
    return this.request(`/api/services/slug/${encodeURIComponent(slug)}${qs}`);
  },

  /**
   * Create New Service / Course
   * Route: POST /api/services
   * Access: super_admin, branch_admin
   * 
   * @param {object} payload - Service data { title, category, slug, short_description, detailed_description, duration_info, is_featured, is_active, display_order }
   * @returns {Promise<object>} { status: 'success', message, service }
   */
  async createService(payload) {
    return this.request('/api/services', {
      method: 'POST',
      body: payload
    });
  },

  /**
   * Update Existing Service / Course
   * Route: PUT /api/services/:id
   * Access: super_admin, branch_admin
   * 
   * @param {number|string} id - Service ID
   * @param {object} payload - Updated service fields
   * @returns {Promise<object>} { status: 'success', message, service }
   */
  async updateService(id, payload) {
    return this.request(`/api/services/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: payload
    });
  },

  /**
   * Toggle / Set Service Publication Status (Soft-delete / Reactivate)
   * Route: PATCH /api/services/:id/status
   * Access: super_admin only
   * 
   * @param {number|string} id - Service ID
   * @param {boolean|undefined} isActive - Explicit boolean or undefined to toggle
   * @returns {Promise<object>} { status: 'success', message, service }
   */
  async toggleServiceStatus(id, isActive = undefined) {
    const body = typeof isActive === 'boolean' ? { is_active: isActive } : {};
    return this.request(`/api/services/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: body
    });
  },

  /**
   * Fetch Branches
   * Route: GET /api/branches
   * 
   * @param {object} params - Query filters { includeInactive }
   * @returns {Promise<object>} { status, count, branches }
   */
  async getBranches(params = {}) {
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        qs.append(key, String(val));
      }
    }
    const query = qs.toString();
    return this.request(`/api/branches${query ? `?${query}` : ''}`);
  },

  /**
   * Fetch Single Branch by Numeric ID
   * Route: GET /api/branches/:id
   * 
   * @param {number|string} id - Branch ID
   * @param {boolean} includeInactive - Include inactive branch (super_admin only)
   * @returns {Promise<object>} { status: 'success', branch }
   */
  async getBranchById(id, includeInactive = false) {
    const qs = includeInactive ? '?includeInactive=true' : '';
    return this.request(`/api/branches/${encodeURIComponent(id)}${qs}`);
  },

  /**
   * Create New Branch
   * Route: POST /api/branches
   * Access: super_admin only
   * 
   * @param {object} payload - Branch data
   * @returns {Promise<object>} { status: 'success', message, branch }
   */
  async createBranch(payload) {
    return this.request('/api/branches', {
      method: 'POST',
      body: payload
    });
  },

  /**
   * Update Existing Branch
   * Route: PUT /api/branches/:id
   * Access: super_admin only
   * 
   * @param {number|string} id - Branch ID
   * @param {object} payload - Updated branch fields
   * @returns {Promise<object>} { status: 'success', message, branch }
   */
  async updateBranch(id, payload) {
    return this.request(`/api/branches/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: payload
    });
  },

  /**
   * Toggle / Set Branch Active Status (Soft-delete / Reactivate)
   * Route: PATCH /api/branches/:id/status
   * Access: super_admin only
   * 
   * @param {number|string} id - Branch ID
   * @param {boolean|undefined} isActive - Explicit boolean or undefined to toggle
   * @returns {Promise<object>} { status: 'success', message, branch }
   */
  async toggleBranchStatus(id, isActive = undefined) {
    const body = typeof isActive === 'boolean' ? { is_active: isActive } : {};
    return this.request(`/api/branches/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: body
    });
  },

  /**
   * Fetch Single Enquiry by Numeric ID
   * Route: GET /api/enquiries/:id
   * 
   * @param {number|string} id - Enquiry ID
   * @returns {Promise<object>} { status: 'success', enquiry }
   */
  async getEnquiryById(id) {
    return this.request(`/api/enquiries/${encodeURIComponent(id)}`);
  },

  /**
   * Fetch Single Enquiry by Reference Code
   * Route: GET /api/enquiries/reference/:reference
   * 
   * @param {string} reference - Reference code (e.g. 'ENQ-2026-F7344C')
   * @returns {Promise<object>} { status: 'success', enquiry }
   */
  async getEnquiryByReference(reference) {
    return this.request(`/api/enquiries/reference/${encodeURIComponent(reference)}`);
  },

  /**
   * Update Enquiry Status and Counselor Notes
   * Route: PATCH /api/enquiries/:id/status
   * Access: super_admin, branch_admin, counselor
   * 
   * @param {number|string} id - Enquiry ID
   * @param {object} payload - { status?: string, counselor_notes?: string }
   * @returns {Promise<object>} { status: 'success', message, enquiry }
   */
  async updateEnquiryStatus(id, payload = {}) {
    return this.request(`/api/enquiries/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: payload
    });
  },

  /**
   * Reassign Enquiry Preferred Branch
   * Route: PATCH /api/enquiries/:id/branch
   * Access: super_admin, branch_admin (counselor denied)
   * 
   * @param {number|string} id - Enquiry ID
   * @param {number|null} preferredBranchId - Target branch ID or null
   * @returns {Promise<object>} { status: 'success', message, enquiry }
   */
  async reassignEnquiryBranch(id, preferredBranchId) {
    return this.request(`/api/enquiries/${encodeURIComponent(id)}/branch`, {
      method: 'PATCH',
      body: { preferred_branch_id: preferredBranchId }
    });
  }
};

// Expose on global window object for vanilla scripts
if (typeof window !== 'undefined') {
  window.adminApi = adminApi;
}
