/**
 * ============================================================================
 * Edupearl Immigration Services and Language Point
 * Admin Dashboard Controller (Phase 2: Admin Dashboard)
 * ============================================================================
 * 
 * Manages dynamic behavior for the Administrative Dashboard:
 * 1. Authenticated administrator profile and welcome presentation.
 * 2. System health monitoring (/api/health and /api/health/db) with live status.
 * 3. Concurrent KPI summary metrics aggregation via Promise.allSettled.
 * 4. Recent enquiries data table with empty/loading/error states.
 * 5. Isolation of metric failures so individual errors do not blank the view.
 * 
 * Security Principles:
 * - Session enforcement relies on HttpOnly cookies and authGuard.
 * - Raw JWT is never accessed or stored client-side.
 * - All server-supplied data strings are safely escaped against XSS.
 * ============================================================================
 */

(function () {
  'use strict';

  /**
   * Safe HTML escaping utility to prevent XSS when inserting server data.
   * @param {string} str - Raw string
   * @returns {string} Sanitized HTML string
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Formats ISO or MySQL date string into human-readable format.
   * e.g., "24 Oct 2026, 04:30 PM"
   * @param {string} dateStr
   * @returns {string} Formatted date string
   */
  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);
      return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(date);
    } catch {
      return String(dateStr);
    }
  }

  /**
   * Formats number with Indian/standard locale commas.
   * @param {number|string} num
   * @returns {string}
   */
  function formatNumber(num) {
    const val = Number(num);
    if (isNaN(val)) return '0';
    return val.toLocaleString('en-IN');
  }

  /**
   * Maps enquiry status to semantic badge HTML.
   * @param {string} status
   * @returns {string} Badge markup
   */
  function renderStatusBadge(status) {
    const safeStatus = (status || 'new').toLowerCase();
    let label = 'New';

    switch (safeStatus) {
      case 'new':
        label = 'New';
        break;
      case 'in_progress':
        label = 'In Progress';
        break;
      case 'contacted':
        label = 'Contacted';
        break;
      case 'converted':
        label = 'Converted';
        break;
      case 'closed':
        label = 'Closed';
        break;
      default:
        label = safeStatus.replace(/_/g, ' ');
    }

    return `<span class="status-badge status-${escapeHtml(safeStatus)}"><span class="badge-dot" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
  }

  // ==========================================================================
  // 1. Administrator Welcome Header
  // ==========================================================================
  function populateAdminProfile(admin) {
    if (!admin) return;

    const nameEl = document.getElementById('welcome-admin-name');
    const roleBadgeEl = document.getElementById('welcome-role-badge');
    const emailEl = document.getElementById('welcome-admin-email');

    if (nameEl) {
      nameEl.textContent = admin.fullName || admin.username || 'Administrator';
    }

    if (emailEl) {
      emailEl.textContent = admin.email ? `(${admin.email})` : '';
    }

    if (roleBadgeEl && window.authGuard) {
      roleBadgeEl.className = `badge badge-role-${admin.role || 'counselor'}`;
      roleBadgeEl.textContent = window.authGuard.formatRole(admin.role);
    }
  }

  // ==========================================================================
  // 2. System Health Diagnostics
  // ==========================================================================
  let isCheckingHealth = false;

  async function checkSystemHealth() {
    if (isCheckingHealth) return;
    isCheckingHealth = true;

    const apiDot = document.getElementById('health-api-dot');
    const apiText = document.getElementById('health-api-text');
    const dbDot = document.getElementById('health-db-dot');
    const dbText = document.getElementById('health-db-text');
    const summaryText = document.getElementById('health-summary-text');
    const timestampText = document.getElementById('health-timestamp');
    const refreshBtn = document.getElementById('btn-health-refresh');

    if (apiDot) apiDot.className = 'status-dot dot-loading';
    if (apiText) apiText.textContent = 'API: Checking...';
    if (dbDot) dbDot.className = 'status-dot dot-loading';
    if (dbText) dbText.textContent = 'Database: Checking...';
    if (summaryText) summaryText.textContent = 'Verifying system operational status...';
    if (refreshBtn) refreshBtn.disabled = true;

    let apiHealthy = false;
    let dbHealthy = false;

    // Check API and Database concurrently
    try {
      const [apiResult, dbResult] = await Promise.allSettled([
        window.adminApi.getHealth(),
        window.adminApi.getDbHealth()
      ]);

      // 1. API Health Evaluation
      if (apiResult.status === 'fulfilled' && apiResult.value && apiResult.value.status === 'ok') {
        apiHealthy = true;
        if (apiDot) apiDot.className = 'status-dot dot-online';
        if (apiText) apiText.textContent = 'API: Operational';
      } else {
        if (apiDot) apiDot.className = 'status-dot dot-offline';
        if (apiText) apiText.textContent = 'API: Offline';
      }

      // 2. Database Health Evaluation
      if (
        dbResult.status === 'fulfilled' &&
        dbResult.value &&
        dbResult.value.status === 'ok' &&
        dbResult.value.database === 'connected'
      ) {
        dbHealthy = true;
        if (dbDot) dbDot.className = 'status-dot dot-online';
        if (dbText) dbText.textContent = 'Database: Connected';
      } else {
        if (dbDot) dbDot.className = 'status-dot dot-offline';
        if (dbText) dbText.textContent = 'Database: Disconnected';
      }

      // 3. Consolidated Overall Status
      // Critical Rule: Do not report system as operational if a health check fails!
      if (apiHealthy && dbHealthy) {
        if (summaryText) {
          summaryText.innerHTML = '<span style="color: var(--color-success); font-weight: 700;">● All Systems Operational</span>';
        }
      } else if (!apiHealthy && !dbHealthy) {
        if (summaryText) {
          summaryText.innerHTML = '<span style="color: var(--color-danger); font-weight: 700;">▲ System Outage Detected: API and Database Unreachable</span>';
        }
      } else if (!dbHealthy) {
        if (summaryText) {
          summaryText.innerHTML = '<span style="color: var(--color-danger); font-weight: 700;">▲ Database Service Unavailable</span>';
        }
      } else {
        if (summaryText) {
          summaryText.innerHTML = '<span style="color: var(--color-warning); font-weight: 700;">▲ API Health Alert</span>';
        }
      }

      // Update timestamp
      if (timestampText) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        timestampText.textContent = `Checked at ${timeStr}`;
      }
    } catch (err) {
      console.error('Unexpected error checking system health:', err);
      if (apiDot) apiDot.className = 'status-dot dot-offline';
      if (apiText) apiText.textContent = 'API: Error';
      if (dbDot) dbDot.className = 'status-dot dot-offline';
      if (dbText) dbText.textContent = 'Database: Error';
      if (summaryText) {
        summaryText.innerHTML = '<span style="color: var(--color-danger); font-weight: 700;">▲ Health Diagnostic Failed</span>';
      }
    } finally {
      isCheckingHealth = false;
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  // ==========================================================================
  // 3. KPI Metrics Aggregation & Individual Resilience
  // ==========================================================================

  /**
   * Helper to set a KPI card into its loading skeleton state.
   */
  function setKpiLoading(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = '<div class="skeleton skeleton-kpi" aria-label="Loading metric..."></div>';
    }
  }

  /**
   * Helper to set a KPI card into an error state with an inline retry button.
   */
  function setKpiError(elementId, retryFnName) {
    const el = document.getElementById(elementId);
    if (el) {
      el.innerHTML = `
        <div class="kpi-card-error">
          <span>Failed to load</span>
          <button type="button" class="btn-kpi-retry" onclick="window.dashboardMetrics.${retryFnName}()">Retry</button>
        </div>
      `;
    }
  }

  /**
   * Helper to set a KPI card with loaded numeric value.
   */
  function setKpiValue(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = formatNumber(value);
    }
  }

  // Individual Metric Fetchers
  async function fetchTotalEnquiries() {
    setKpiLoading('kpi-total-enquiries');
    try {
      const data = await window.adminApi.getEnquiries({ limit: 1 });
      const total = data.pagination && typeof data.pagination.total === 'number' ? data.pagination.total : 0;
      setKpiValue('kpi-total-enquiries', total);
      return total;
    } catch (err) {
      console.warn('Error fetching total enquiries:', err);
      setKpiError('kpi-total-enquiries', 'fetchTotalEnquiries');
      throw err;
    }
  }

  async function fetchNewEnquiries() {
    setKpiLoading('kpi-new-enquiries');
    try {
      const data = await window.adminApi.getEnquiries({ status: 'new', limit: 1 });
      const total = data.pagination && typeof data.pagination.total === 'number' ? data.pagination.total : 0;
      setKpiValue('kpi-new-enquiries', total);
      return total;
    } catch (err) {
      console.warn('Error fetching new enquiries:', err);
      setKpiError('kpi-new-enquiries', 'fetchNewEnquiries');
      throw err;
    }
  }

  async function fetchInProgressEnquiries() {
    setKpiLoading('kpi-in-progress-enquiries');
    try {
      const data = await window.adminApi.getEnquiries({ status: 'in_progress', limit: 1 });
      const total = data.pagination && typeof data.pagination.total === 'number' ? data.pagination.total : 0;
      setKpiValue('kpi-in-progress-enquiries', total);
      return total;
    } catch (err) {
      console.warn('Error fetching in-progress enquiries:', err);
      setKpiError('kpi-in-progress-enquiries', 'fetchInProgressEnquiries');
      throw err;
    }
  }

  async function fetchConvertedEnquiries() {
    setKpiLoading('kpi-converted-enquiries');
    try {
      const data = await window.adminApi.getEnquiries({ status: 'converted', limit: 1 });
      const total = data.pagination && typeof data.pagination.total === 'number' ? data.pagination.total : 0;
      setKpiValue('kpi-converted-enquiries', total);
      return total;
    } catch (err) {
      console.warn('Error fetching converted enquiries:', err);
      setKpiError('kpi-converted-enquiries', 'fetchConvertedEnquiries');
      throw err;
    }
  }

  async function fetchActiveServices() {
    setKpiLoading('kpi-active-services');
    try {
      const data = await window.adminApi.getServices();
      const count = typeof data.count === 'number'
        ? data.count
        : (Array.isArray(data.services) ? data.services.length : 0);
      setKpiValue('kpi-active-services', count);
      return count;
    } catch (err) {
      console.warn('Error fetching active services:', err);
      setKpiError('kpi-active-services', 'fetchActiveServices');
      throw err;
    }
  }

  async function fetchActiveBranches() {
    setKpiLoading('kpi-active-branches');
    try {
      const data = await window.adminApi.getBranches();
      const count = typeof data.count === 'number'
        ? data.count
        : (Array.isArray(data.branches) ? data.branches.length : 0);
      setKpiValue('kpi-active-branches', count);
      return count;
    } catch (err) {
      console.warn('Error fetching active branches:', err);
      setKpiError('kpi-active-branches', 'fetchActiveBranches');
      throw err;
    }
  }

  /**
   * Concurrently initiates all 6 metric requests with Promise.allSettled.
   * Isolates failures so one failure doesn't blank the remaining metrics.
   */
  async function loadAllMetrics() {
    await Promise.allSettled([
      fetchTotalEnquiries(),
      fetchNewEnquiries(),
      fetchInProgressEnquiries(),
      fetchConvertedEnquiries(),
      fetchActiveServices(),
      fetchActiveBranches()
    ]);
  }

  // Expose retry functions to window for onclick handlers
  window.dashboardMetrics = {
    fetchTotalEnquiries,
    fetchNewEnquiries,
    fetchInProgressEnquiries,
    fetchConvertedEnquiries,
    fetchActiveServices,
    fetchActiveBranches,
    loadAllMetrics
  };

  // ==========================================================================
  // 4. Recent Enquiries Data Table
  // ==========================================================================
  async function loadRecentEnquiries() {
    const tableContainer = document.getElementById('recent-enquiries-table-container');
    const tbody = document.getElementById('recent-enquiries-tbody');
    const emptyState = document.getElementById('recent-enquiries-empty');
    const errorState = document.getElementById('recent-enquiries-error');

    if (!tbody) return;

    // Show skeleton loading rows
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="skeleton skeleton-row"></div>
          <div class="skeleton skeleton-row"></div>
          <div class="skeleton skeleton-row"></div>
        </td>
      </tr>
    `;

    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';

    try {
      // Query 5 most recent enquiries sorted by creation date descending
      const data = await window.adminApi.getEnquiries({
        limit: 5,
        sortBy: 'created_at',
        sortOrder: 'DESC'
      });

      const enquiries = Array.isArray(data.enquiries) ? data.enquiries : [];

      if (enquiries.length === 0) {
        if (tableContainer) tableContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      // Render table rows safely with verified fields
      tbody.innerHTML = enquiries.map((item) => {
        const ref = item.enquiry_reference || `EP-${item.id}`;
        const name = item.full_name || 'Anonymous Applicant';
        const contact = item.phone || item.email || (item.city ? `City: ${item.city}` : 'No contact specified');
        const service = item.service_title || 'General Enquiry';
        const branch = item.branch_name || 'All / Unassigned';
        const dateFormatted = formatDateTime(item.created_at);
        const statusHtml = renderStatusBadge(item.status);

        return `
          <tr>
            <td>
              <span class="ref-code">${escapeHtml(ref)}</span>
            </td>
            <td>
              <div class="applicant-info">
                <strong>${escapeHtml(name)}</strong>
                <span class="applicant-contact">${escapeHtml(contact)}</span>
              </div>
            </td>
            <td>
              <span>${escapeHtml(service)}</span>
            </td>
            <td>
              <span>${escapeHtml(branch)}</span>
            </td>
            <td>
              ${statusHtml}
            </td>
            <td style="white-space: nowrap; color: var(--color-slate-500); font-size: 0.8125rem;">
              ${escapeHtml(dateFormatted)}
            </td>
            <td style="text-align: right; white-space: nowrap;">
              <a 
                href="/admin/enquiries.html?id=${encodeURIComponent(item.id)}" 
                class="btn btn-outline btn-sm"
                title="View details for ${escapeHtml(ref)}">
                View
              </a>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error('Error fetching recent enquiries:', err);
      if (tableContainer) tableContainer.style.display = 'none';
      if (errorState) {
        errorState.style.display = 'block';
        const errorMsg = errorState.querySelector('.error-message-text');
        if (errorMsg) {
          errorMsg.textContent = err.message || 'Unable to retrieve recent enquiries.';
        }
      }
    }
  }

  // ==========================================================================
  // 5. Dashboard Initialization Lifecycle
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      // Initialize shared auth guard (validates session, renders sidebar and topbar)
      const admin = await window.authGuard.init({
        pageTitle: 'Admin Dashboard'
      });

      if (!admin) {
        // If not authenticated, authGuard redirects to /admin/login.html
        return;
      }

      // Populate welcome header
      populateAdminProfile(admin);

      // Attach health check refresh button listener
      const healthRefreshBtn = document.getElementById('btn-health-refresh');
      if (healthRefreshBtn) {
        healthRefreshBtn.addEventListener('click', () => {
          checkSystemHealth();
        });
      }

      // Attach retry button for recent enquiries error state
      const recentRetryBtn = document.getElementById('btn-retry-recent-enquiries');
      if (recentRetryBtn) {
        recentRetryBtn.addEventListener('click', () => {
          loadRecentEnquiries();
        });
      }

      // Execute initial data loads concurrently
      checkSystemHealth();
      loadAllMetrics();
      loadRecentEnquiries();

    } catch (err) {
      console.error('Dashboard initialization failed:', err);
    }
  });

})();
