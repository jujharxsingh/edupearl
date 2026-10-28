/**
 * ============================================================================
 * Edupearl Immigration Services and Language Point
 * Enquiry Management Controller (Phase 3)
 * ============================================================================
 * 
 * Manages the administrative Enquiry Management interface:
 * 1. Filterable, searchable, sortable, and paginated enquiries listing.
 * 2. Dynamic branch and service dropdown population from backend APIs.
 * 3. Real-time debounced keyword search.
 * 4. Detailed enquiry inspection modal with complete applicant info.
 * 5. Status progression and counselor internal notes updating.
 * 6. Role-aware preferred branch reassignment (super_admin & branch_admin).
 * 7. Accessible modal handling with keyboard navigation and focus management.
 * 
 * Security Principles:
 * - Session enforcement relies on HttpOnly cookies via authGuard.
 * - All server-supplied data is safely escaped against XSS.
 * - Raw JWT is never accessed or stored client-side.
 * - Backend remains the authoritative boundary for authorization.
 * ============================================================================
 */

(function () {
  'use strict';

  // Allowed enquiry statuses per database & API contract
  const ALLOWED_STATUSES = ['new', 'in_progress', 'contacted', 'converted', 'closed'];

  // Module state
  const state = {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    search: '',
    status: '',
    branchId: '',
    serviceId: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'created_at',
    sortOrder: 'DESC',
    currentEnquiry: null,
    branches: [],
    services: [],
    isLoading: false,
    admin: null
  };

  let searchDebounceTimer = null;

  // ==========================================================================
  // 1. Sanitization & Formatting Utilities
  // ==========================================================================

  /**
   * Safe HTML escaping utility to prevent XSS.
   * @param {string|null|undefined} str
   * @returns {string} Sanitized string
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
   * e.g., "25 Oct 2026, 1:55 pm"
   * @param {string|null} dateStr
   * @returns {string} Formatted date
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
   * Renders semantic colored status badge.
   * @param {string} status
   * @returns {string} Badge HTML
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
  // 2. Metadata & Filter Options Initialization
  // ==========================================================================

  /**
   * Loads active branches and services to populate filter and modal dropdowns.
   */
  async function loadFilterDropdownOptions() {
    try {
      const [branchesRes, servicesRes] = await Promise.allSettled([
        window.adminApi.getBranches(),
        window.adminApi.getServices()
      ]);

      // 1. Populate Branch Dropdowns
      if (branchesRes.status === 'fulfilled' && branchesRes.value && Array.isArray(branchesRes.value.branches)) {
        state.branches = branchesRes.value.branches;

        const filterBranchSelect = document.getElementById('filter-branch');
        const modalBranchSelect = document.getElementById('modal-reassign-branch-select');

        const branchOptionsHtml = state.branches
          .map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)} (${escapeHtml(b.city)})</option>`)
          .join('');

        if (filterBranchSelect) {
          filterBranchSelect.innerHTML = `<option value="">All Branches</option>${branchOptionsHtml}`;
        }
        if (modalBranchSelect) {
          modalBranchSelect.innerHTML = `<option value="">— No Preferred Branch (Unassigned) —</option>${branchOptionsHtml}`;
        }
      }

      // 2. Populate Service Filter Dropdown
      if (servicesRes.status === 'fulfilled' && servicesRes.value && Array.isArray(servicesRes.value.services)) {
        state.services = servicesRes.value.services;

        const filterServiceSelect = document.getElementById('filter-service');
        if (filterServiceSelect) {
          const serviceOptionsHtml = state.services
            .map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.title)}</option>`)
            .join('');
          filterServiceSelect.innerHTML = `<option value="">All Services &amp; Courses</option>${serviceOptionsHtml}`;
        }
      }
    } catch (err) {
      console.warn('Could not populate filter dropdown options:', err);
    }
  }

  // ==========================================================================
  // 3. Enquiry Listing Retrieval & Table Rendering
  // ==========================================================================

  /**
   * Fetches paginated enquiries according to current state filters.
   */
  async function loadEnquiries() {
    if (state.isLoading) return;
    state.isLoading = true;

    const tbody = document.getElementById('enquiries-tbody');
    const tableContainer = document.getElementById('enquiries-table-container');
    const emptyState = document.getElementById('enquiries-empty-state');
    const errorBanner = document.getElementById('enquiries-error-banner');
    const errorText = document.getElementById('enquiries-error-text');
    const countInfo = document.getElementById('enquiries-count-info');
    const paginationNav = document.getElementById('pagination-nav-container');

    // Show skeleton loading state
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="skeleton skeleton-row"></div>
            <div class="skeleton skeleton-row"></div>
            <div class="skeleton skeleton-row"></div>
            <div class="skeleton skeleton-row"></div>
          </td>
        </tr>
      `;
    }

    if (errorBanner) errorBanner.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';
    if (countInfo) countInfo.textContent = 'Fetching enquiries...';

    // Prepare query parameters
    const params = {
      page: state.page,
      limit: state.limit,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder
    };

    if (state.search.trim()) params.search = state.search.trim();
    if (state.status) params.status = state.status;
    if (state.branchId) params.branchId = state.branchId;
    if (state.serviceId) params.serviceId = state.serviceId;
    if (state.dateFrom) params.dateFrom = state.dateFrom;
    if (state.dateTo) params.dateTo = state.dateTo;

    try {
      const data = await window.adminApi.getEnquiries(params);

      const enquiries = Array.isArray(data.enquiries) ? data.enquiries : [];
      const pagination = data.pagination || {};

      state.total = typeof pagination.total === 'number' ? pagination.total : enquiries.length;
      state.totalPages = typeof pagination.totalPages === 'number' ? pagination.totalPages : Math.ceil(state.total / state.limit) || 1;
      state.page = typeof pagination.page === 'number' ? pagination.page : 1;

      // Update counter text
      if (countInfo) {
        if (state.total === 0) {
          countInfo.textContent = 'No enquiries found matching filters.';
        } else {
          const startRecord = (state.page - 1) * state.limit + 1;
          const endRecord = Math.min(startRecord + enquiries.length - 1, state.total);
          countInfo.textContent = `Showing ${startRecord}–${endRecord} of ${state.total} ${state.total === 1 ? 'enquiry' : 'enquiries'}`;
        }
      }

      // Handle Empty State
      if (enquiries.length === 0) {
        if (tableContainer) tableContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        if (paginationNav) paginationNav.style.display = 'none';
        return;
      }

      // Render Table Rows
      if (paginationNav) paginationNav.style.display = 'flex';
      renderTableRows(enquiries);
      updatePaginationControls();

    } catch (err) {
      console.error('Failed to load enquiries:', err);
      if (tableContainer) tableContainer.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      if (paginationNav) paginationNav.style.display = 'none';
      if (errorBanner) {
        errorBanner.style.display = 'flex';
        if (errorText) {
          errorText.textContent = err.message || 'Unable to connect to the server. Please try again.';
        }
      }
      if (countInfo) countInfo.textContent = 'Error loading enquiries.';
    } finally {
      state.isLoading = false;
    }
  }

  /**
   * Injects sanitized enquiry rows into the tbody element.
   * @param {Array<object>} enquiries
   */
  function renderTableRows(enquiries) {
    const tbody = document.getElementById('enquiries-tbody');
    if (!tbody) return;

    tbody.innerHTML = enquiries.map((item) => {
      const ref = item.enquiry_reference || `EP-${item.id}`;
      const name = item.full_name || 'Anonymous Applicant';
      const contactInfo = item.phone || item.email || (item.city ? `City: ${item.city}` : 'No contact specified');
      const service = item.service_title || 'General Enquiry';
      const branch = item.branch_name || 'Unassigned / Any';
      const country = item.target_country || '—';
      const dateFormatted = formatDateTime(item.created_at);
      const statusHtml = renderStatusBadge(item.status);

      return `
        <tr data-enquiry-id="${escapeHtml(item.id)}">
          <td>
            <span class="ref-code">${escapeHtml(ref)}</span>
          </td>
          <td>
            <div class="applicant-info">
              <strong>${escapeHtml(name)}</strong>
              <span class="applicant-contact">${escapeHtml(contactInfo)}</span>
            </div>
          </td>
          <td>
            <span>${escapeHtml(service)}</span>
          </td>
          <td>
            <span>${escapeHtml(branch)}</span>
          </td>
          <td>
            <span style="font-size: 0.8125rem;">${escapeHtml(country)}</span>
          </td>
          <td>
            ${statusHtml}
          </td>
          <td style="white-space: nowrap; color: var(--color-slate-500); font-size: 0.8125rem;">
            ${escapeHtml(dateFormatted)}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button 
              type="button" 
              class="btn btn-outline btn-sm"
              onclick="window.enquiryModule.openModal(${Number(item.id)})"
              title="View and manage details for ${escapeHtml(ref)}"
              aria-label="View details for enquiry ${escapeHtml(ref)}">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Updates previous/next buttons and page indicator text.
   */
  function updatePaginationControls() {
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    const pageInfo = document.getElementById('pagination-page-info');
    const indicatorText = document.getElementById('pagination-indicator-text');

    if (prevBtn) prevBtn.disabled = state.page <= 1;
    if (nextBtn) nextBtn.disabled = state.page >= state.totalPages;
    if (pageInfo) pageInfo.textContent = `Page ${state.page} of ${state.totalPages}`;
    if (indicatorText) indicatorText.textContent = `Page ${state.page}`;
  }

  // ==========================================================================
  // 4. Accessible Enquiry Detail Modal
  // ==========================================================================

  /**
   * Clears feedback alert box inside modal.
   */
  function clearModalAlert() {
    const alertBox = document.getElementById('modal-alert-box');
    const alertText = document.getElementById('modal-alert-text');
    if (alertBox) {
      alertBox.style.display = 'none';
      alertBox.className = 'alert';
    }
    if (alertText) alertText.textContent = '';
  }

  /**
   * Scrolls the modal's own scrollable content container to the top so alerts are immediately visible.
   */
  function scrollModalToTop() {
    const modalBody = document.getElementById('enquiry-modal-body') || document.querySelector('#enquiry-modal-overlay .modal-body');
    if (!modalBody) return;

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

    const performScroll = () => {
      if (typeof modalBody.scrollTo === 'function') {
        try {
          modalBody.scrollTo({ top: 0, behavior: scrollBehavior });
        } catch (_) {
          modalBody.scrollTop = 0;
        }
      } else {
        modalBody.scrollTop = 0;
      }
    };

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(performScroll);
    } else {
      performScroll();
    }
  }

  /**
   * Shows success or error alert inside modal.
   * @param {string} type - 'success' | 'danger'
   * @param {string} message
   */
  function showModalAlert(type, message) {
    const alertBox = document.getElementById('modal-alert-box');
    const alertText = document.getElementById('modal-alert-text');
    const alertIcon = document.getElementById('modal-alert-icon');

    if (alertBox && alertText) {
      alertBox.className = `alert alert-${type}`;
      alertText.textContent = message;
      if (alertIcon) {
        alertIcon.textContent = type === 'success' ? '✓' : '⚠️';
      }
      alertBox.style.display = 'flex';

      if (type === 'success') {
        scrollModalToTop();
      }
    }
  }

  /**
   * Opens detail modal by enquiry ID or Reference string.
   * @param {number|string} idOrRef
   */
  async function openModal(idOrRef) {
    clearModalAlert();

    const overlay = document.getElementById('enquiry-modal-overlay');
    if (!overlay) return;

    // Reset scroll position so new enquiry modal opens at the top
    const modalBody = document.getElementById('enquiry-modal-body') || overlay.querySelector('.modal-body');
    if (modalBody) {
      modalBody.scrollTop = 0;
    }

    // Show modal in loading state
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('active'));

    const refEl = document.getElementById('modal-enquiry-ref');
    const statusBadgeEl = document.getElementById('modal-status-badge');
    const nameEl = document.getElementById('modal-applicant-name');
    const emailEl = document.getElementById('modal-applicant-email');
    const phoneEl = document.getElementById('modal-applicant-phone');
    const cityEl = document.getElementById('modal-applicant-city');
    const serviceEl = document.getElementById('modal-service-title');
    const branchEl = document.getElementById('modal-branch-name');
    const countryEl = document.getElementById('modal-target-country');
    const dateEl = document.getElementById('modal-submission-date');
    const messageEl = document.getElementById('modal-client-message');
    const updatedEl = document.getElementById('modal-last-updated-text');
    const statusSelect = document.getElementById('modal-update-status');
    const notesTextarea = document.getElementById('modal-update-notes');
    const charCounter = document.getElementById('notes-char-counter');
    const branchSelect = document.getElementById('modal-reassign-branch-select');

    if (refEl) refEl.textContent = 'Loading...';
    if (statusBadgeEl) statusBadgeEl.innerHTML = '';
    if (nameEl) nameEl.textContent = 'Loading...';

    try {
      let data = null;
      if (typeof idOrRef === 'number' || /^\d+$/.test(String(idOrRef))) {
        data = await window.adminApi.getEnquiryById(idOrRef);
      } else {
        data = await window.adminApi.getEnquiryByReference(idOrRef);
      }

      const enquiry = data.enquiry;
      if (!enquiry) throw new Error('Enquiry record not found.');

      state.currentEnquiry = enquiry;

      // Populate Modal Fields
      if (refEl) refEl.textContent = enquiry.enquiry_reference || `EP-${enquiry.id}`;
      if (statusBadgeEl) statusBadgeEl.innerHTML = renderStatusBadge(enquiry.status);
      if (nameEl) nameEl.textContent = enquiry.full_name || '—';
      if (emailEl) {
        emailEl.innerHTML = enquiry.email
          ? `<a href="mailto:${escapeHtml(enquiry.email)}" style="color: var(--color-primary);">${escapeHtml(enquiry.email)}</a>`
          : '—';
      }
      if (phoneEl) {
        phoneEl.innerHTML = enquiry.phone
          ? `<a href="tel:${escapeHtml(enquiry.phone)}" style="color: var(--color-primary);">${escapeHtml(enquiry.phone)}</a>`
          : '—';
      }
      if (cityEl) cityEl.textContent = enquiry.city || '—';
      if (serviceEl) {
        serviceEl.textContent = enquiry.service_title
          ? `${enquiry.service_title}${enquiry.service_category ? ` (${enquiry.service_category.replace(/_/g, ' ')})` : ''}`
          : 'General Enquiry';
      }
      if (branchEl) {
        branchEl.textContent = enquiry.branch_name
          ? `${enquiry.branch_name}${enquiry.branch_code ? ` [${enquiry.branch_code}]` : ''}`
          : 'No preferred branch (Unassigned)';
      }
      if (countryEl) countryEl.textContent = enquiry.target_country || 'Not specified';
      if (dateEl) dateEl.textContent = formatDateTime(enquiry.created_at);
      if (messageEl) messageEl.textContent = enquiry.message || 'No message provided.';
      if (updatedEl) updatedEl.textContent = `Last modified: ${formatDateTime(enquiry.updated_at)}`;

      // Populate Update Status Form
      if (statusSelect) statusSelect.value = enquiry.status || 'new';
      if (notesTextarea) {
        notesTextarea.value = enquiry.counselor_notes || '';
        if (charCounter) charCounter.textContent = `${(enquiry.counselor_notes || '').length} / 5000 characters`;
      }

      // Branch Reassignment Section & Role Restrictions
      const isSuperAdminOrBranchAdmin = state.admin && (state.admin.role === 'super_admin' || state.admin.role === 'branch_admin');
      const formReassignBranch = document.getElementById('form-reassign-branch');
      const counselorBranchNotice = document.getElementById('counselor-branch-notice');

      if (isSuperAdminOrBranchAdmin) {
        if (formReassignBranch) formReassignBranch.style.display = 'block';
        if (counselorBranchNotice) counselorBranchNotice.style.display = 'none';
        if (branchSelect) {
          branchSelect.value = enquiry.preferred_branch_id ? String(enquiry.preferred_branch_id) : '';
        }
      } else {
        // Counselors cannot reassign branches
        if (formReassignBranch) formReassignBranch.style.display = 'none';
        if (counselorBranchNotice) counselorBranchNotice.style.display = 'flex';
      }

      // Focus Close button for accessibility
      const closeBtn = document.getElementById('btn-modal-close');
      if (closeBtn) closeBtn.focus();

    } catch (err) {
      console.error('Error loading enquiry details:', err);
      showModalAlert('danger', err.message || 'Unable to retrieve enquiry details.');
    }
  }

  /**
   * Closes the detail modal.
   */
  function closeModal() {
    const overlay = document.getElementById('enquiry-modal-overlay');
    if (!overlay) return;

    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.style.display = 'none';
      clearModalAlert();
      state.currentEnquiry = null;

      // Clean URL search query if an ID was deep linked
      if (window.location.search.includes('id=') || window.location.search.includes('ref=')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }, 200);
  }

  // ==========================================================================
  // 5. Status & Counselor Notes Update
  // ==========================================================================
  async function handleStatusNotesSubmit() {
    if (!state.currentEnquiry) return;

    const statusSelect = document.getElementById('modal-update-status');
    const notesTextarea = document.getElementById('modal-update-notes');
    const saveBtn = document.getElementById('btn-save-status-notes');

    const newStatus = statusSelect ? statusSelect.value : state.currentEnquiry.status;
    const newNotes = notesTextarea ? notesTextarea.value.trim() : '';

    if (!ALLOWED_STATUSES.includes(newStatus)) {
      showModalAlert('danger', `Invalid status. Permitted values: ${ALLOWED_STATUSES.join(', ')}`);
      return;
    }

    if (newNotes.length > 5000) {
      showModalAlert('danger', 'Counselor notes must not exceed 5000 characters.');
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner" style="margin-right: 0.5rem;"></span>Saving...';
    }

    try {
      const result = await window.adminApi.updateEnquiryStatus(state.currentEnquiry.id, {
        status: newStatus,
        counselor_notes: newNotes
      });

      const updated = result.enquiry;
      state.currentEnquiry = updated;

      // Update modal display
      const statusBadgeEl = document.getElementById('modal-status-badge');
      if (statusBadgeEl) statusBadgeEl.innerHTML = renderStatusBadge(updated.status);

      const updatedEl = document.getElementById('modal-last-updated-text');
      if (updatedEl) updatedEl.textContent = `Last modified: ${formatDateTime(updated.updated_at)}`;

      showModalAlert('success', 'Enquiry status and counselor notes updated successfully.');

      // Refresh background table to keep list in sync
      loadEnquiries();

    } catch (err) {
      console.error('Failed to update status and notes:', err);
      showModalAlert('danger', err.message || 'Failed to update enquiry status.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Status & Notes';
      }
    }
  }

  // ==========================================================================
  // 6. Branch Reassignment
  // ==========================================================================
  async function handleBranchReassignmentSubmit() {
    if (!state.currentEnquiry) return;

    // Strict role check
    const isAuthorized = state.admin && (state.admin.role === 'super_admin' || state.admin.role === 'branch_admin');
    if (!isAuthorized) {
      showModalAlert('danger', 'Access Denied: Only Super Administrators and Branch Administrators may reassign branches.');
      return;
    }

    const branchSelect = document.getElementById('modal-reassign-branch-select');
    const saveBtn = document.getElementById('btn-save-branch-reassignment');

    let targetBranchId = null;
    if (branchSelect && branchSelect.value.trim() !== '') {
      targetBranchId = parseInt(branchSelect.value, 10);
      if (!Number.isInteger(targetBranchId) || targetBranchId <= 0) {
        showModalAlert('danger', 'Please select a valid branch.');
        return;
      }
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner" style="margin-right: 0.5rem;"></span>Reassigning...';
    }

    try {
      const result = await window.adminApi.reassignEnquiryBranch(state.currentEnquiry.id, targetBranchId);
      const updated = result.enquiry;
      state.currentEnquiry = updated;

      // Update modal display
      const branchEl = document.getElementById('modal-branch-name');
      if (branchEl) {
        branchEl.textContent = updated.branch_name
          ? `${updated.branch_name}${updated.branch_code ? ` [${updated.branch_code}]` : ''}`
          : 'No preferred branch (Unassigned)';
      }

      const updatedEl = document.getElementById('modal-last-updated-text');
      if (updatedEl) updatedEl.textContent = `Last modified: ${formatDateTime(updated.updated_at)}`;

      showModalAlert('success', 'Preferred branch reassigned successfully.');

      // Refresh background table to reflect branch update
      loadEnquiries();

    } catch (err) {
      console.error('Failed to reassign branch:', err);
      showModalAlert('danger', err.message || 'Failed to reassign preferred branch.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Reassign Branch';
      }
    }
  }

  // ==========================================================================
  // 7. Event Handlers & Filter Listeners
  // ==========================================================================
  function attachEventListeners() {
    // 1. Search Keyword Debounce (300ms)
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          state.search = e.target.value.trim();
          state.page = 1;
          loadEnquiries();
        }, 300);
      });
    }

    // 2. Filter Selects
    const statusSelect = document.getElementById('filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        state.status = e.target.value;
        state.page = 1;
        loadEnquiries();
      });
    }

    const branchSelect = document.getElementById('filter-branch');
    if (branchSelect) {
      branchSelect.addEventListener('change', (e) => {
        state.branchId = e.target.value;
        state.page = 1;
        loadEnquiries();
      });
    }

    const serviceSelect = document.getElementById('filter-service');
    if (serviceSelect) {
      serviceSelect.addEventListener('change', (e) => {
        state.serviceId = e.target.value;
        state.page = 1;
        loadEnquiries();
      });
    }

    const dateFromInput = document.getElementById('filter-date-from');
    if (dateFromInput) {
      dateFromInput.addEventListener('change', (e) => {
        state.dateFrom = e.target.value;
        state.page = 1;
        loadEnquiries();
      });
    }

    const dateToInput = document.getElementById('filter-date-to');
    if (dateToInput) {
      dateToInput.addEventListener('change', (e) => {
        state.dateTo = e.target.value;
        state.page = 1;
        loadEnquiries();
      });
    }

    const sortBySelect = document.getElementById('filter-sort-by');
    if (sortBySelect) {
      sortBySelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        state.page = 1;
        loadEnquiries();
      });
    }

    const sortOrderSelect = document.getElementById('filter-sort-order');
    if (sortOrderSelect) {
      sortOrderSelect.addEventListener('change', (e) => {
        state.sortOrder = e.target.value;
        state.page = 1;
        loadEnquiries();
      });
    }

    // 3. Clear Filters Handlers
    const resetFilters = () => {
      state.search = '';
      state.status = '';
      state.branchId = '';
      state.serviceId = '';
      state.dateFrom = '';
      state.dateTo = '';
      state.sortBy = 'created_at';
      state.sortOrder = 'DESC';
      state.page = 1;

      if (searchInput) searchInput.value = '';
      if (statusSelect) statusSelect.value = '';
      if (branchSelect) branchSelect.value = '';
      if (serviceSelect) serviceSelect.value = '';
      if (dateFromInput) dateFromInput.value = '';
      if (dateToInput) dateToInput.value = '';
      if (sortBySelect) sortBySelect.value = 'created_at';
      if (sortOrderSelect) sortOrderSelect.value = 'DESC';

      loadEnquiries();
    };

    const clearFiltersBtn = document.getElementById('btn-clear-filters');
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', resetFilters);

    const emptyClearBtn = document.getElementById('btn-empty-clear-filters');
    if (emptyClearBtn) emptyClearBtn.addEventListener('click', resetFilters);

    // 4. Page Size Selector
    const pageSizeSelect = document.getElementById('page-size-select');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        state.limit = parseInt(e.target.value, 10) || 20;
        state.page = 1;
        loadEnquiries();
      });
    }

    // 5. Pagination Buttons
    const prevBtn = document.getElementById('btn-prev-page');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (state.page > 1) {
          state.page--;
          loadEnquiries();
        }
      });
    }

    const nextBtn = document.getElementById('btn-next-page');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (state.page < state.totalPages) {
          state.page++;
          loadEnquiries();
        }
      });
    }

    // 6. Refresh Listing & Retry Buttons
    const refreshBtn = document.getElementById('btn-refresh-listing');
    if (refreshBtn) refreshBtn.addEventListener('click', () => loadEnquiries());

    const retryBtn = document.getElementById('btn-retry-enquiries');
    if (retryBtn) retryBtn.addEventListener('click', () => loadEnquiries());

    // 7. Modal Close Handlers (Button, Footer, Backdrop, Escape Key)
    const closeBtn = document.getElementById('btn-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    const closeFooterBtn = document.getElementById('btn-modal-close-footer');
    if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);

    const overlay = document.getElementById('enquiry-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
        closeModal();
      }
    });

    // 8. Modal Counselor Notes Character Counter
    const notesTextarea = document.getElementById('modal-update-notes');
    const charCounter = document.getElementById('notes-char-counter');
    if (notesTextarea && charCounter) {
      notesTextarea.addEventListener('input', () => {
        charCounter.textContent = `${notesTextarea.value.length} / 5000 characters`;
      });
    }

    // 9. Modal Form Submit Handlers
    const statusForm = document.getElementById('form-update-status-notes');
    if (statusForm) {
      statusForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleStatusNotesSubmit();
      });
    }

    const branchForm = document.getElementById('form-reassign-branch');
    if (branchForm) {
      branchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleBranchReassignmentSubmit();
      });
    }
  }

  // ==========================================================================
  // 8. Module Initialization Lifecycle
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      // Initialize shared auth guard
      const admin = await window.authGuard.init({
        pageTitle: 'Enquiry Management'
      });

      if (!admin) return;
      state.admin = admin;

      // Attach event listeners
      attachEventListeners();

      // Populate branch and service dropdown options
      await loadFilterDropdownOptions();

      // Check URL search parameters for deep linking (?id=..., ?ref=..., ?status=...)
      const urlParams = new URLSearchParams(window.location.search);
      const deepId = urlParams.get('id');
      const deepRef = urlParams.get('ref');
      const deepStatus = urlParams.get('status');

      if (deepStatus && ALLOWED_STATUSES.includes(deepStatus)) {
        state.status = deepStatus;
        const statusSelect = document.getElementById('filter-status');
        if (statusSelect) statusSelect.value = deepStatus;
      }

      // Initial data load
      await loadEnquiries();

      // Open detail modal if deep linked by ID or Reference
      if (deepId) {
        openModal(parseInt(deepId, 10));
      } else if (deepRef) {
        openModal(deepRef);
      }

    } catch (err) {
      console.error('Enquiry module initialization failed:', err);
    }
  });

  // Global namespace export for inline HTML onclick handlers
  window.enquiryModule = {
    openModal,
    closeModal,
    loadEnquiries
  };

})();
