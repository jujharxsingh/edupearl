/**
 * ============================================================================
 * Edupearl Immigration Services and Language Point
 * Services & Courses Management Module (Phase 4)
 * ============================================================================
 * 
 * Manages language training courses and immigration advisory offerings.
 * 
 * Role-Based Access Control (RBAC):
 * - super_admin:  View active & inactive, Add, Edit, Activate/Deactivate
 * - branch_admin: View active, Add, Edit (No inactive visibility, no status toggle)
 * - counselor:    View active only (Read-only interface: no add, edit, or status controls)
 * 
 * Security Principles:
 * 1. Sanitizes and safely renders all text content against XSS.
 * 2. Never stores or logs raw credentials or JWT tokens in browser storage.
 * 3. Handles HTTP 401, 403, 404, and 409 (Conflict on duplicate slug) cleanly.
 * 4. Backend remains the authoritative security enforcement point.
 * ============================================================================
 */

(function () {
  'use strict';

  // Module State
  let currentAdmin = null;
  let allServices = [];
  let currentTargetService = null;
  let isSubmitting = false;
  let slugManuallyEdited = false;
  let notificationTimeout = null;

  // DOM Elements
  const btnRefresh = document.getElementById('btn-refresh-listing');
  const btnAddService = document.getElementById('btn-add-service');
  const counselorBanner = document.getElementById('counselor-notice-banner');
  const notificationBanner = document.getElementById('services-notification-banner');
  const notificationText = document.getElementById('services-notification-text');

  // Filter elements
  const filterSearch = document.getElementById('filter-search');
  const filterCategory = document.getElementById('filter-category');
  const filterInactiveContainer = document.getElementById('filter-inactive-container');
  const filterIncludeInactive = document.getElementById('filter-include-inactive');
  const btnClearFilters = document.getElementById('btn-clear-filters');
  const btnEmptyClearFilters = document.getElementById('btn-empty-clear-filters');

  // Listing elements
  const servicesCountInfo = document.getElementById('services-count-info');
  const servicesSummaryBadges = document.getElementById('services-summary-badges');
  const servicesErrorBanner = document.getElementById('services-error-banner');
  const servicesErrorText = document.getElementById('services-error-text');
  const btnRetryServices = document.getElementById('btn-retry-services');
  const servicesTbody = document.getElementById('services-tbody');
  const servicesEmptyState = document.getElementById('services-empty-state');
  const servicesTableContainer = document.getElementById('services-table-container');

  // Add / Edit Modal elements
  const modalServiceOverlay = document.getElementById('modal-service-overlay');
  const modalServiceTitle = document.getElementById('modal-service-title');
  const btnCloseServiceModal = document.getElementById('btn-close-service-modal');
  const btnCancelService = document.getElementById('btn-cancel-service');
  const btnSaveService = document.getElementById('btn-save-service');
  const btnSaveSpinner = document.getElementById('btn-save-spinner');
  const btnSaveText = document.getElementById('btn-save-text');
  const modalServiceAlert = document.getElementById('modal-service-alert');
  const modalServiceAlertText = document.getElementById('modal-service-alert-text');

  // Form fields
  const fieldServiceId = document.getElementById('service-id');
  const fieldTitle = document.getElementById('service-title');
  const counterTitle = document.getElementById('counter-title');
  const fieldCategory = document.getElementById('service-category');
  const fieldSlug = document.getElementById('service-slug');
  const fieldShortDesc = document.getElementById('service-short-description');
  const counterShortDesc = document.getElementById('counter-short-desc');
  const fieldDetailedDesc = document.getElementById('service-detailed-description');
  const fieldDuration = document.getElementById('service-duration-info');
  const fieldOrder = document.getElementById('service-display-order');
  const fieldFeatured = document.getElementById('service-is-featured');
  const fieldActive = document.getElementById('service-is-active');
  const activeContainer = document.getElementById('service-active-container');

  // View Details Modal elements
  const modalViewOverlay = document.getElementById('modal-view-overlay');
  const btnCloseViewModal = document.getElementById('btn-close-view-modal');
  const btnCloseViewFooter = document.getElementById('btn-close-view-footer');
  const modalViewStatusBadge = document.getElementById('modal-view-status-badge');
  const modalViewFeaturedBadge = document.getElementById('modal-view-featured-badge');
  const modalViewFooterInfo = document.getElementById('modal-view-footer-info');

  const viewFieldTitle = document.getElementById('view-field-title');
  const viewFieldCategory = document.getElementById('view-field-category');
  const viewFieldSlug = document.getElementById('view-field-slug');
  const viewFieldDuration = document.getElementById('view-field-duration');
  const viewFieldOrder = document.getElementById('view-field-order');
  const viewFieldId = document.getElementById('view-field-id');
  const viewFieldShortDesc = document.getElementById('view-field-short-desc');
  const viewFieldDetailedDesc = document.getElementById('view-field-detailed-desc');
  const viewFieldCreated = document.getElementById('view-field-created');
  const viewFieldUpdated = document.getElementById('view-field-updated');

  // Status Confirmation Modal elements
  const modalConfirmOverlay = document.getElementById('modal-confirm-status-overlay');
  const modalConfirmTitle = document.getElementById('modal-confirm-status-title');
  const btnCloseConfirmModal = document.getElementById('btn-close-confirm-modal');
  const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
  const btnExecuteStatusChange = document.getElementById('btn-execute-status-change');
  const btnStatusSpinner = document.getElementById('btn-status-spinner');
  const btnStatusBtnText = document.getElementById('btn-status-btn-text');
  const confirmWarningBox = document.getElementById('confirm-warning-box');
  const confirmWarningTitle = document.getElementById('confirm-warning-title');
  const confirmWarningText = document.getElementById('confirm-warning-text');
  const confirmTargetTitle = document.getElementById('confirm-target-title');
  const confirmTargetSlug = document.getElementById('confirm-target-slug');

  /**
   * Safe HTML Escaper to prevent Cross-Site Scripting (XSS).
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /**
   * Generates a URL-friendly slug from text matching backend slugify.
   */
  function slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  }

  /**
   * Format ISO date string into human-friendly format.
   */
  function formatDate(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  }

  /**
   * Shows a temporary notification toast banner.
   */
  function showNotification(message) {
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
    }
    notificationText.textContent = message;
    notificationBanner.style.display = 'flex';
    notificationTimeout = setTimeout(() => {
      notificationBanner.style.display = 'none';
    }, 4500);
  }

  /**
   * Displays modal validation or conflict error banner.
   */
  function showModalAlert(message) {
    modalServiceAlertText.textContent = message;
    modalServiceAlert.style.display = 'flex';
  }

  function hideModalAlert() {
    modalServiceAlert.style.display = 'none';
  }

  /**
   * Updates character counter indicators.
   */
  function updateCounters() {
    if (counterTitle && fieldTitle) {
      counterTitle.textContent = `${fieldTitle.value.length} / 150`;
    }
    if (counterShortDesc && fieldShortDesc) {
      counterShortDesc.textContent = `${fieldShortDesc.value.length} / 300`;
    }
  }

  /**
   * Renders Category Badge HTML.
   */
  function renderCategoryBadge(category) {
    if (category === 'language_course') {
      return '<span class="badge badge-cat-course">Language Course</span>';
    }
    if (category === 'immigration_service') {
      return '<span class="badge badge-cat-service">Immigration Service</span>';
    }
    return `<span class="badge">${escapeHtml(category)}</span>`;
  }

  /**
   * Renders Publication Status Badge HTML.
   */
  function renderStatusBadge(isActive) {
    if (isActive) {
      return '<span class="status-badge status-active"><span class="badge-dot" aria-hidden="true"></span> Active</span>';
    }
    return '<span class="status-badge status-inactive"><span class="badge-dot" aria-hidden="true"></span> Inactive</span>';
  }

  /**
   * Fetch services and courses from existing API.
   */
  async function loadServices() {
    try {
      // Show loading skeleton rows
      servicesTbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="skeleton skeleton-row"></div>
            <div class="skeleton skeleton-row"></div>
            <div class="skeleton skeleton-row"></div>
          </td>
        </tr>
      `;
      servicesEmptyState.style.display = 'none';
      servicesErrorBanner.style.display = 'none';
      servicesTableContainer.style.display = 'block';
      servicesCountInfo.textContent = 'Loading services and courses...';

      const isSuperAdmin = currentAdmin && currentAdmin.role === 'super_admin';
      const includeInactive = isSuperAdmin && filterIncludeInactive && filterIncludeInactive.checked;

      const params = {};
      if (filterCategory && filterCategory.value) {
        params.category = filterCategory.value;
      }
      if (includeInactive) {
        params.includeInactive = 'true';
      }

      const response = await window.adminApi.getServices(params);
      allServices = Array.isArray(response.services) ? response.services : [];

      renderTable();
    } catch (err) {
      console.error('Failed to load services:', err);
      servicesTbody.innerHTML = '';
      servicesTableContainer.style.display = 'none';
      servicesEmptyState.style.display = 'none';
      servicesErrorText.textContent = err.message || 'Failed to retrieve services from server.';
      servicesErrorBanner.style.display = 'flex';
      servicesCountInfo.textContent = 'Error loading records.';
    }
  }

  /**
   * Filters and renders the loaded services into the data table.
   */
  function renderTable() {
    const isSuperAdmin = currentAdmin && currentAdmin.role === 'super_admin';
    const isBranchAdmin = currentAdmin && currentAdmin.role === 'branch_admin';
    const canWrite = isSuperAdmin || isBranchAdmin;
    const canToggleStatus = isSuperAdmin;

    // Filter by search keyword (title or slug)
    const searchTerm = (filterSearch.value || '').trim().toLowerCase();
    const filtered = allServices.filter(service => {
      if (!searchTerm) return true;
      const titleMatch = (service.title || '').toLowerCase().includes(searchTerm);
      const slugMatch = (service.slug || '').toLowerCase().includes(searchTerm);
      const shortDescMatch = (service.short_description || '').toLowerCase().includes(searchTerm);
      return titleMatch || slugMatch || shortDescMatch;
    });

    // Update count and summary badges
    const totalCount = filtered.length;
    const coursesCount = filtered.filter(s => s.category === 'language_course').length;
    const servicesCount = filtered.filter(s => s.category === 'immigration_service').length;
    const inactiveCount = filtered.filter(s => !s.is_active).length;

    servicesCountInfo.textContent = `Showing ${totalCount} ${totalCount === 1 ? 'record' : 'records'}`;

    let summaryHtml = `
      <span class="badge badge-cat-course">${coursesCount} Courses</span>
      <span class="badge badge-cat-service">${servicesCount} Immigration Services</span>
    `;
    if (inactiveCount > 0 && isSuperAdmin) {
      summaryHtml += `<span class="badge badge-status-inactive">${inactiveCount} Inactive</span>`;
    }
    servicesSummaryBadges.innerHTML = summaryHtml;

    if (filtered.length === 0) {
      servicesTbody.innerHTML = '';
      servicesTableContainer.style.display = 'none';
      servicesEmptyState.style.display = 'block';
      return;
    }

    servicesEmptyState.style.display = 'none';
    servicesTableContainer.style.display = 'block';

    const rowsHtml = filtered.map(service => {
      const featuredBadge = service.is_featured
        ? '<span class="badge-featured" title="Featured program">⭐ Featured</span>'
        : '<span style="color: var(--color-slate-400);">—</span>';

      // Build Action Buttons based on authenticated role
      let actionsHtml = `
        <button type="button" class="btn btn-secondary btn-sm btn-action-view" data-id="${service.id}" aria-label="View details for ${escapeHtml(service.title)}">
          View
        </button>
      `;

      if (canWrite) {
        actionsHtml += `
          <button type="button" class="btn btn-outline btn-sm btn-action-edit" data-id="${service.id}" aria-label="Edit ${escapeHtml(service.title)}">
            Edit
          </button>
        `;
      }

      if (canToggleStatus) {
        if (service.is_active) {
          actionsHtml += `
            <button type="button" class="btn btn-outline btn-sm btn-action-toggle-status" data-id="${service.id}" data-action="deactivate" style="color: var(--color-danger); border-color: var(--color-danger-border);" aria-label="Deactivate ${escapeHtml(service.title)}">
              Deactivate
            </button>
          `;
        } else {
          actionsHtml += `
            <button type="button" class="btn btn-outline btn-sm btn-action-toggle-status" data-id="${service.id}" data-action="activate" style="color: var(--color-success); border-color: var(--color-success-border);" aria-label="Reactivate ${escapeHtml(service.title)}">
              Reactivate
            </button>
          `;
        }
      }

      return `
        <tr data-service-id="${service.id}" style="${!service.is_active ? 'opacity: 0.75; background-color: #fafafa;' : ''}">
          <td>
            <span class="order-chip">${Number.isInteger(service.display_order) ? service.display_order : 0}</span>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--color-slate-900);">
              ${escapeHtml(service.title)}
            </div>
            <div style="font-family: ui-monospace, monospace; font-size: 0.75rem; color: var(--color-slate-500); margin-top: 0.15rem;">
              /${escapeHtml(service.slug)}
            </div>
          </td>
          <td>
            ${renderCategoryBadge(service.category)}
          </td>
          <td>
            <span style="font-size: 0.8125rem;">${escapeHtml(service.duration_info || '—')}</span>
          </td>
          <td>
            ${featuredBadge}
          </td>
          <td>
            ${renderStatusBadge(service.is_active)}
          </td>
          <td style="text-align: right;">
            <div class="table-actions">
              ${actionsHtml}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    servicesTbody.innerHTML = rowsHtml;
  }

  /**
   * Opens the Add New Service modal dialog.
   */
  function openAddModal() {
    hideModalAlert();
    slugManuallyEdited = false;
    modalServiceTitle.textContent = 'Add New Service / Course';

    fieldServiceId.value = '';
    fieldTitle.value = '';
    fieldCategory.value = '';
    fieldSlug.value = '';
    fieldShortDesc.value = '';
    fieldDetailedDesc.value = '';
    fieldDuration.value = '';
    fieldOrder.value = '0';
    fieldFeatured.checked = false;

    // Role check for active status field
    const isSuperAdmin = currentAdmin && currentAdmin.role === 'super_admin';
    if (activeContainer) {
      activeContainer.style.display = isSuperAdmin ? 'block' : 'none';
      fieldActive.checked = true;
    }

    btnSaveText.textContent = 'Create Service / Course';
    btnSaveSpinner.style.display = 'none';
    btnSaveService.disabled = false;
    isSubmitting = false;

    updateCounters();
    modalServiceOverlay.style.display = 'flex';
    modalServiceOverlay.classList.add('active');
    fieldTitle.focus();
  }

  /**
   * Opens the Edit Service modal dialog.
   */
  async function openEditModal(serviceId) {
    hideModalAlert();
    slugManuallyEdited = true; // In edit mode, do not auto-overwrite slug on title change
    modalServiceTitle.textContent = 'Edit Service / Course';

    const id = parseInt(serviceId, 10);
    const service = allServices.find(s => s.id === id);

    if (!service) {
      showNotification('Service record not found.');
      return;
    }

    fieldServiceId.value = service.id;
    fieldTitle.value = service.title || '';
    fieldCategory.value = service.category || '';
    fieldSlug.value = service.slug || '';
    fieldShortDesc.value = service.short_description || '';
    fieldDetailedDesc.value = service.detailed_description || '';
    fieldDuration.value = service.duration_info || '';
    fieldOrder.value = service.display_order !== undefined ? service.display_order : 0;
    fieldFeatured.checked = Boolean(service.is_featured);

    const isSuperAdmin = currentAdmin && currentAdmin.role === 'super_admin';
    if (activeContainer) {
      activeContainer.style.display = isSuperAdmin ? 'block' : 'none';
      fieldActive.checked = Boolean(service.is_active);
    }

    btnSaveText.textContent = 'Update Service / Course';
    btnSaveSpinner.style.display = 'none';
    btnSaveService.disabled = false;
    isSubmitting = false;

    updateCounters();
    modalServiceOverlay.style.display = 'flex';
    modalServiceOverlay.classList.add('active');
    fieldTitle.focus();
  }

  /**
   * Closes the Add / Edit modal.
   */
  function closeServiceModal() {
    modalServiceOverlay.classList.remove('active');
    modalServiceOverlay.style.display = 'none';
    hideModalAlert();
  }

  /**
   * Opens the Read-Only View Details modal.
   */
  function openViewModal(serviceId) {
    const id = parseInt(serviceId, 10);
    const service = allServices.find(s => s.id === id);

    if (!service) {
      showNotification('Service record not found.');
      return;
    }

    viewFieldTitle.textContent = service.title || '—';
    viewFieldCategory.innerHTML = renderCategoryBadge(service.category);
    viewFieldSlug.textContent = service.slug ? `/${service.slug}` : '—';
    viewFieldDuration.textContent = service.duration_info || '—';
    viewFieldOrder.textContent = String(service.display_order !== undefined ? service.display_order : 0);
    viewFieldId.textContent = String(service.id);
    viewFieldShortDesc.textContent = service.short_description || '—';
    viewFieldDetailedDesc.textContent = service.detailed_description || 'No detailed description provided.';
    viewFieldCreated.textContent = formatDate(service.created_at);
    viewFieldUpdated.textContent = formatDate(service.updated_at);

    modalViewStatusBadge.innerHTML = renderStatusBadge(service.is_active);
    modalViewFeaturedBadge.innerHTML = service.is_featured
      ? '<span class="badge-featured">⭐ Featured</span>'
      : '';

    modalViewFooterInfo.textContent = `Record ID: #${service.id} • ${service.category.replace('_', ' ')}`;

    modalViewOverlay.style.display = 'flex';
    modalViewOverlay.classList.add('active');
  }

  function closeViewModal() {
    modalViewOverlay.classList.remove('active');
    modalViewOverlay.style.display = 'none';
  }

  /**
   * Opens the Status Confirmation modal (Super Admin only).
   */
  function openConfirmStatusModal(serviceId, action) {
    const id = parseInt(serviceId, 10);
    const service = allServices.find(s => s.id === id);

    if (!service) {
      showNotification('Service record not found.');
      return;
    }

    currentTargetService = { ...service, targetAction: action };
    confirmTargetTitle.textContent = service.title;
    confirmTargetSlug.textContent = service.slug;

    if (action === 'deactivate') {
      modalConfirmTitle.textContent = 'Confirm Deactivation';
      confirmWarningTitle.textContent = 'Deactivating Service / Course';
      confirmWarningText.textContent = 'Deactivating this record hides it from the public active catalog and enquiry forms, but preserves its historical database record and client enquiries. You can reactivate it at any time.';
      confirmWarningBox.style.backgroundColor = '#fffbeb';
      confirmWarningBox.style.borderColor = '#fde68a';
      confirmWarningBox.style.color = '#92400e';
      btnStatusBtnText.textContent = 'Confirm Deactivation';
      btnExecuteStatusChange.className = 'btn btn-danger btn-sm';
    } else {
      modalConfirmTitle.textContent = 'Confirm Reactivation';
      confirmWarningTitle.textContent = 'Reactivating Service / Course';
      confirmWarningText.textContent = 'Reactivating this record will make it immediately visible to public website visitors and enable prospective clients to select it on enquiry forms.';
      confirmWarningBox.style.backgroundColor = '#ecfdf5';
      confirmWarningBox.style.borderColor = '#a7f3d0';
      confirmWarningBox.style.color = '#065f46';
      btnStatusBtnText.textContent = 'Confirm Reactivation';
      btnExecuteStatusChange.className = 'btn btn-primary btn-sm';
    }

    btnStatusSpinner.style.display = 'none';
    btnExecuteStatusChange.disabled = false;

    modalConfirmOverlay.style.display = 'flex';
    modalConfirmOverlay.classList.add('active');
  }

  function closeConfirmModal() {
    modalConfirmOverlay.classList.remove('active');
    modalConfirmOverlay.style.display = 'none';
    currentTargetService = null;
  }

  /**
   * Executes the status toggle via PATCH /api/services/:id/status.
   */
  async function executeStatusChange() {
    if (!currentTargetService || isSubmitting) return;

    try {
      isSubmitting = true;
      btnStatusSpinner.style.display = 'inline-block';
      btnExecuteStatusChange.disabled = true;

      const targetActive = currentTargetService.targetAction === 'activate';
      const response = await window.adminApi.toggleServiceStatus(currentTargetService.id, targetActive);

      closeConfirmModal();
      showNotification(response.message || (targetActive ? 'Service activated successfully.' : 'Service deactivated successfully.'));
      await loadServices();
    } catch (err) {
      console.error('Failed to change status:', err);
      alert(err.message || 'Failed to update publication status. Please try again.');
    } finally {
      isSubmitting = false;
      btnStatusSpinner.style.display = 'none';
      btnExecuteStatusChange.disabled = false;
    }
  }

  /**
   * Validates form and saves new or updated service record.
   */
  async function saveService() {
    if (isSubmitting) return;
    hideModalAlert();

    const title = fieldTitle.value.trim();
    const category = fieldCategory.value.trim();
    const slug = fieldSlug.value.trim().toLowerCase();
    const shortDesc = fieldShortDesc.value.trim();
    const detailedDesc = fieldDetailedDesc.value.trim();
    const duration = fieldDuration.value.trim();
    const rawOrder = fieldOrder.value.trim();
    const isFeatured = fieldFeatured.checked;
    const isSuperAdmin = currentAdmin && currentAdmin.role === 'super_admin';

    // 1. Title Validation
    if (!title || title.length < 2 || title.length > 150) {
      showModalAlert('Title is required and must be between 2 and 150 characters.');
      fieldTitle.focus();
      return;
    }

    // 2. Category Validation
    if (!category || !['language_course', 'immigration_service'].includes(category)) {
      showModalAlert('Please select a valid category (Language Course or Immigration Service).');
      fieldCategory.focus();
      return;
    }

    // 3. Slug Validation
    if (!slug) {
      showModalAlert('URL Slug is required.');
      fieldSlug.focus();
      return;
    }
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug) || slug.length < 2 || slug.length > 100) {
      showModalAlert('URL Slug must be between 2 and 100 lowercase alphanumeric characters and single hyphens (e.g. "ielts-academic-coaching").');
      fieldSlug.focus();
      return;
    }

    // 4. Short Description Validation
    if (!shortDesc || shortDesc.length < 5 || shortDesc.length > 300) {
      showModalAlert('Short description is required and must be between 5 and 300 characters.');
      fieldShortDesc.focus();
      return;
    }

    // 5. Duration Info Validation
    if (duration && duration.length > 100) {
      showModalAlert('Duration info must not exceed 100 characters.');
      fieldDuration.focus();
      return;
    }

    // 6. Display Order Validation
    const orderNum = Number(rawOrder);
    if (!Number.isInteger(orderNum)) {
      showModalAlert('Display order must be an integer (e.g. 0, 1, 2).');
      fieldOrder.focus();
      return;
    }

    // Prepare payload
    const payload = {
      title,
      category,
      slug,
      short_description: shortDesc,
      detailed_description: detailedDesc.length > 0 ? detailedDesc : null,
      duration_info: duration.length > 0 ? duration : null,
      is_featured: isFeatured,
      display_order: orderNum
    };

    // If Super Admin, include is_active
    if (isSuperAdmin && fieldActive) {
      payload.is_active = fieldActive.checked;
    }

    const editId = fieldServiceId.value ? parseInt(fieldServiceId.value, 10) : null;

    try {
      isSubmitting = true;
      btnSaveSpinner.style.display = 'inline-block';
      btnSaveService.disabled = true;

      let response;
      if (editId) {
        response = await window.adminApi.updateService(editId, payload);
      } else {
        response = await window.adminApi.createService(payload);
      }

      closeServiceModal();
      showNotification(response.message || (editId ? 'Service updated successfully.' : 'Service created successfully.'));
      await loadServices();
    } catch (err) {
      console.error('Failed to save service:', err);

      // Handle duplicate slug (HTTP 409 Conflict)
      if (err.status === 409) {
        showModalAlert(`Conflict: A service or course with slug "${escapeHtml(slug)}" already exists. Please choose a different unique slug.`);
        fieldSlug.focus();
      } else if (err.status === 400) {
        showModalAlert(err.message || 'Invalid input. Please check the required fields.');
      } else if (err.status === 403) {
        showModalAlert('Access denied: You do not have permission to perform this action.');
      } else {
        showModalAlert(err.message || 'An unexpected error occurred while saving.');
      }
    } finally {
      isSubmitting = false;
      btnSaveSpinner.style.display = 'none';
      btnSaveService.disabled = false;
    }
  }

  /**
   * Resets all search and category filters.
   */
  function clearFilters() {
    filterSearch.value = '';
    filterCategory.value = '';
    if (filterIncludeInactive) {
      filterIncludeInactive.checked = false;
    }
    loadServices();
  }

  /**
   * Attaches event listeners to the DOM.
   */
  function attachEventListeners() {
    // Top Bar actions
    btnRefresh.addEventListener('click', loadServices);
    btnAddService.addEventListener('click', openAddModal);

    // Filters
    filterSearch.addEventListener('input', () => {
      renderTable();
    });

    filterCategory.addEventListener('change', () => {
      loadServices();
    });

    if (filterIncludeInactive) {
      filterIncludeInactive.addEventListener('change', () => {
        loadServices();
      });
    }

    btnClearFilters.addEventListener('click', clearFilters);
    btnEmptyClearFilters.addEventListener('click', clearFilters);
    btnRetryServices.addEventListener('click', loadServices);

    // Auto-slug generator on Title input
    fieldTitle.addEventListener('input', function () {
      updateCounters();
      if (!slugManuallyEdited && !fieldServiceId.value) {
        fieldSlug.value = slugify(this.value);
      }
    });

    fieldSlug.addEventListener('input', function () {
      slugManuallyEdited = true;
    });

    fieldShortDesc.addEventListener('input', updateCounters);

    // Add / Edit Modal buttons
    btnSaveService.addEventListener('click', saveService);
    btnCloseServiceModal.addEventListener('click', closeServiceModal);
    btnCancelService.addEventListener('click', closeServiceModal);

    // View Modal buttons
    btnCloseViewModal.addEventListener('click', closeViewModal);
    btnCloseViewFooter.addEventListener('click', closeViewModal);

    // Status Confirmation Modal buttons
    btnCloseConfirmModal.addEventListener('click', closeConfirmModal);
    btnCancelConfirm.addEventListener('click', closeConfirmModal);
    btnExecuteStatusChange.addEventListener('click', executeStatusChange);

    // Event delegation for table action buttons
    servicesTbody.addEventListener('click', function (e) {
      const target = e.target.closest('button');
      if (!target) return;

      const serviceId = target.getAttribute('data-id');
      if (!serviceId) return;

      if (target.classList.contains('btn-action-view')) {
        openViewModal(serviceId);
      } else if (target.classList.contains('btn-action-edit')) {
        openEditModal(serviceId);
      } else if (target.classList.contains('btn-action-toggle-status')) {
        const action = target.getAttribute('data-action');
        openConfirmStatusModal(serviceId, action);
      }
    });

    // Close modals on clicking overlay backdrop
    [modalServiceOverlay, modalViewOverlay, modalConfirmOverlay].forEach(overlay => {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          overlay.classList.remove('active');
          overlay.style.display = 'none';
        }
      });
    });

    // Close modals on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (modalServiceOverlay.classList.contains('active')) closeServiceModal();
        if (modalViewOverlay.classList.contains('active')) closeViewModal();
        if (modalConfirmOverlay.classList.contains('active')) closeConfirmModal();
      }
    });
  }

  /**
   * Initializes module after authentication verification.
   */
  async function init() {
    try {
      // Initialize Auth Guard
      currentAdmin = await window.authGuard.init({ pageTitle: 'Services & Courses' });

      if (!currentAdmin) return;

      const isSuperAdmin = currentAdmin.role === 'super_admin';
      const isBranchAdmin = currentAdmin.role === 'branch_admin';
      const isCounselor = currentAdmin.role === 'counselor';

      // 1. Role-aware UI configurations
      if (isSuperAdmin || isBranchAdmin) {
        btnAddService.style.display = 'inline-flex';
      }

      if (isSuperAdmin) {
        filterInactiveContainer.style.display = 'flex';
      }

      if (isCounselor) {
        counselorBanner.style.display = 'flex';
      }

      // Attach DOM events
      attachEventListeners();

      // Load initial services catalog
      await loadServices();
    } catch (err) {
      console.error('Services management initialization failed:', err);
    }
  }

  // Self-initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
