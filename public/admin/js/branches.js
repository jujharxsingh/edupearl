/**
 * ============================================================================
 * Edupearl Immigration Services and Language Point
 * Branch Management Module (Phase 5)
 * ============================================================================
 * 
 * Manages physical branch offices and training centers.
 * 
 * Strict Role-Based Access Control (RBAC):
 * - super_admin:  Full management (View active/inactive, Add, Edit, Deactivate/Reactivate)
 * - branch_admin: View active branches via API/Enquiries; management UI restricted
 * - counselor:    View active branches via API/Enquiries; management UI restricted
 * 
 * Security Principles:
 * 1. Safe HTML rendering against XSS attacks.
 * 2. No client-side storage of JWT tokens.
 * 3. Handles HTTP 401, 403, 404, and 409 (duplicate branch code) cleanly.
 * 4. Preserves historical enquiry associations (soft-delete policy).
 * ============================================================================
 */

(function () {
  'use strict';

  // Module State
  let currentAdmin = null;
  let allBranches = [];
  let currentTargetBranch = null;
  let isSubmitting = false;
  let notificationTimeout = null;

  // DOM Elements
  const accessRestrictedView = document.getElementById('access-restricted-view');
  const branchesManagementView = document.getElementById('branches-management-view');

  const btnRefresh = document.getElementById('btn-refresh-listing');
  const btnAddBranch = document.getElementById('btn-add-branch');
  const notificationBanner = document.getElementById('branches-notification-banner');
  const notificationText = document.getElementById('branches-notification-text');

  // Filter elements
  const filterSearch = document.getElementById('filter-search');
  const filterIncludeInactive = document.getElementById('filter-include-inactive');
  const btnClearFilters = document.getElementById('btn-clear-filters');
  const btnEmptyClearFilters = document.getElementById('btn-empty-clear-filters');

  // Directory listing elements
  const branchesCountInfo = document.getElementById('branches-count-info');
  const branchesSummaryBadges = document.getElementById('branches-summary-badges');
  const branchesErrorBanner = document.getElementById('branches-error-banner');
  const branchesErrorText = document.getElementById('branches-error-text');
  const btnRetryBranches = document.getElementById('btn-retry-branches');
  const branchesTbody = document.getElementById('branches-tbody');
  const branchesEmptyState = document.getElementById('branches-empty-state');
  const branchesTableContainer = document.getElementById('branches-table-container');

  // Add / Edit Modal elements
  const modalBranchOverlay = document.getElementById('modal-branch-overlay');
  const modalBranchTitle = document.getElementById('modal-branch-title');
  const btnCloseBranchModal = document.getElementById('btn-close-branch-modal');
  const btnCancelBranch = document.getElementById('btn-cancel-branch');
  const btnSaveBranch = document.getElementById('btn-save-branch');
  const btnSaveSpinner = document.getElementById('btn-save-spinner');
  const btnSaveText = document.getElementById('btn-save-text');
  const modalBranchAlert = document.getElementById('modal-branch-alert');
  const modalBranchAlertText = document.getElementById('modal-branch-alert-text');

  // Form fields
  const fieldBranchId = document.getElementById('branch-id');
  const fieldCode = document.getElementById('branch-code');
  const fieldName = document.getElementById('branch-name');
  const fieldAddress1 = document.getElementById('branch-address1');
  const fieldAddress2 = document.getElementById('branch-address2');
  const fieldCity = document.getElementById('branch-city');
  const fieldState = document.getElementById('branch-state');
  const fieldPostal = document.getElementById('branch-postal');
  const fieldCountry = document.getElementById('branch-country');
  const fieldPhone = document.getElementById('branch-phone');
  const fieldEmail = document.getElementById('branch-email');
  const fieldActive = document.getElementById('branch-active');

  // View Modal elements
  const modalViewOverlay = document.getElementById('modal-view-branch-overlay');
  const btnCloseViewModal = document.getElementById('btn-close-view-modal');
  const btnCloseViewFooter = document.getElementById('btn-close-view-footer');
  const modalViewStatusBadge = document.getElementById('modal-view-status-badge');
  const modalViewDemoBadge = document.getElementById('modal-view-demo-badge');
  const modalViewFooterInfo = document.getElementById('modal-view-footer-info');

  const viewBranchCode = document.getElementById('view-branch-code');
  const viewBranchName = document.getElementById('view-branch-name');
  const viewBranchCity = document.getElementById('view-branch-city');
  const viewBranchStateCountry = document.getElementById('view-branch-state-country');
  const viewBranchPostal = document.getElementById('view-branch-postal');
  const viewBranchId = document.getElementById('view-branch-id');
  const viewBranchFullAddress = document.getElementById('view-branch-full-address');
  const viewBranchPhone = document.getElementById('view-branch-phone');
  const viewBranchEmail = document.getElementById('view-branch-email');
  const viewBranchCreated = document.getElementById('view-branch-created');
  const viewBranchUpdated = document.getElementById('view-branch-updated');

  // Status Confirmation Modal elements
  const modalConfirmOverlay = document.getElementById('modal-confirm-branch-status-overlay');
  const modalConfirmTitle = document.getElementById('modal-confirm-branch-title');
  const btnCloseConfirmModal = document.getElementById('btn-close-confirm-modal');
  const btnCancelConfirm = document.getElementById('btn-cancel-branch-confirm');
  const btnExecuteBranchStatus = document.getElementById('btn-execute-branch-status');
  const btnStatusSpinner = document.getElementById('btn-status-spinner');
  const btnStatusBtnText = document.getElementById('btn-status-btn-text');
  const confirmWarningBox = document.getElementById('confirm-warning-box');
  const confirmWarningTitle = document.getElementById('confirm-warning-title');
  const confirmWarningText = document.getElementById('confirm-warning-text');
  const confirmTargetBranchName = document.getElementById('confirm-target-branch-name');
  const confirmTargetBranchCode = document.getElementById('confirm-target-branch-code');

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
    modalBranchAlertText.textContent = message;
    modalBranchAlert.style.display = 'flex';
  }

  function hideModalAlert() {
    modalBranchAlert.style.display = 'none';
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
   * Fetch branches from API.
   */
  async function loadBranches() {
    try {
      branchesTbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="skeleton skeleton-row"></div>
            <div class="skeleton skeleton-row"></div>
            <div class="skeleton skeleton-row"></div>
          </td>
        </tr>
      `;
      branchesEmptyState.style.display = 'none';
      branchesErrorBanner.style.display = 'none';
      branchesTableContainer.style.display = 'block';
      branchesCountInfo.textContent = 'Loading branch directory...';

      const isSuperAdmin = currentAdmin && currentAdmin.role === 'super_admin';
      const includeInactive = isSuperAdmin && filterIncludeInactive && filterIncludeInactive.checked;

      const params = {};
      if (includeInactive) {
        params.includeInactive = 'true';
      }

      const response = await window.adminApi.getBranches(params);
      allBranches = Array.isArray(response.branches) ? response.branches : [];
      allBranches.sort((a, b) =>
        String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true, sensitivity: 'base' })
      );

      renderTable();
    } catch (err) {
      console.error('Failed to load branches:', err);
      branchesTbody.innerHTML = '';
      branchesTableContainer.style.display = 'none';
      branchesEmptyState.style.display = 'none';
      branchesErrorText.textContent = err.message || 'Failed to retrieve branches from server.';
      branchesErrorBanner.style.display = 'flex';
      branchesCountInfo.textContent = 'Error loading branch records.';
    }
  }

  /**
   * Filters and renders loaded branches into the data table.
   */
  function renderTable() {
    const isSuperAdmin = currentAdmin && currentAdmin.role === 'super_admin';

    // Filter by keyword search (name, code, or city)
    const searchTerm = (filterSearch.value || '').trim().toLowerCase();
    const filtered = allBranches.filter(branch => {
      if (!searchTerm) return true;
      const nameMatch = (branch.name || '').toLowerCase().includes(searchTerm);
      const codeMatch = (branch.code || '').toLowerCase().includes(searchTerm);
      const cityMatch = (branch.city || '').toLowerCase().includes(searchTerm);
      const stateMatch = (branch.state || '').toLowerCase().includes(searchTerm);
      return nameMatch || codeMatch || cityMatch || stateMatch;
    });

    // Sort by branch.code in ascending, case-insensitive alphanumeric order
    filtered.sort((a, b) =>
      String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true, sensitivity: 'base' })
    );

    // Update count and summary badges
    const totalCount = filtered.length;
    const activeCount = filtered.filter(b => b.is_active).length;
    const inactiveCount = filtered.filter(b => !b.is_active).length;

    branchesCountInfo.textContent = `Showing ${totalCount} ${totalCount === 1 ? 'branch' : 'branches'}`;

    let summaryHtml = `
      <span class="badge" style="background-color: var(--color-slate-100); color: var(--color-slate-700);">${activeCount} Active</span>
    `;
    if (inactiveCount > 0 && isSuperAdmin) {
      summaryHtml += `<span class="badge badge-status-inactive">${inactiveCount} Inactive</span>`;
    }
    branchesSummaryBadges.innerHTML = summaryHtml;

    if (filtered.length === 0) {
      branchesTbody.innerHTML = '';
      branchesTableContainer.style.display = 'none';
      branchesEmptyState.style.display = 'block';
      return;
    }

    branchesEmptyState.style.display = 'none';
    branchesTableContainer.style.display = 'block';

    const rowsHtml = filtered.map(branch => {
      const isDemo = (branch.name || '').includes('[DEMO / TEST]') || (branch.code || '').startsWith('DEMO-');
      const demoBadge = isDemo
        ? '<div style="margin-top: 0.25rem;"><span class="badge-demo">Demo Campus</span></div>'
        : '';

      // Address construction
      const fullAddressLines = [
        branch.address_line1,
        branch.address_line2,
        `${branch.city}, ${branch.state} - ${branch.postal_code}`
      ].filter(Boolean);

      // Contact info construction
      const phoneHtml = branch.phone
        ? `<div class="branch-contact-item"><span aria-hidden="true">📞</span> <a href="tel:${escapeHtml(branch.phone)}">${escapeHtml(branch.phone)}</a></div>`
        : '<div class="branch-contact-item" style="color: var(--color-slate-400); font-style: italic;">No phone listed</div>';

      const emailHtml = branch.email
        ? `<div class="branch-contact-item"><span aria-hidden="true">✉️</span> <a href="mailto:${escapeHtml(branch.email)}">${escapeHtml(branch.email)}</a></div>`
        : '<div class="branch-contact-item" style="color: var(--color-slate-400); font-style: italic;">No email listed</div>';

      // Status action button (Super Admin only)
      let statusActionBtn = '';
      if (isSuperAdmin) {
        if (branch.is_active) {
          statusActionBtn = `
            <button type="button" class="btn btn-outline btn-sm btn-action-toggle-status" data-id="${branch.id}" data-action="deactivate" style="color: var(--color-danger); border-color: var(--color-danger-border);" aria-label="Deactivate branch ${escapeHtml(branch.name)}">
              Deactivate
            </button>
          `;
        } else {
          statusActionBtn = `
            <button type="button" class="btn btn-outline btn-sm btn-action-toggle-status" data-id="${branch.id}" data-action="activate" style="color: var(--color-success); border-color: var(--color-success-border);" aria-label="Reactivate branch ${escapeHtml(branch.name)}">
              Reactivate
            </button>
          `;
        }
      }

      return `
        <tr data-branch-id="${branch.id}" style="${!branch.is_active ? 'opacity: 0.75; background-color: #fafafa;' : ''}">
          <td>
            <span class="badge-branch-code">${escapeHtml(branch.code)}</span>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--color-slate-900);">
              ${escapeHtml(branch.name)}
            </div>
            ${demoBadge}
          </td>
          <td>
            <div class="city-state" style="font-weight: 600; color: var(--color-slate-800);">
              ${escapeHtml(branch.city)}, ${escapeHtml(branch.state)}
            </div>
            <div style="font-size: 0.75rem; color: var(--color-slate-500);">
              ${escapeHtml(branch.country || 'India')}
            </div>
          </td>
          <td>
            <div class="address-block">
              <div>${escapeHtml(branch.address_line1)}</div>
              ${branch.address_line2 ? `<div>${escapeHtml(branch.address_line2)}</div>` : ''}
              <div style="font-size: 0.75rem; color: var(--color-slate-500);">${escapeHtml(branch.postal_code)}</div>
            </div>
          </td>
          <td>
            <div class="branch-contact-list">
              ${phoneHtml}
              ${emailHtml}
            </div>
          </td>
          <td>
            ${renderStatusBadge(branch.is_active)}
          </td>
          <td style="text-align: right;">
            <div class="table-actions">
              <button type="button" class="btn btn-secondary btn-sm btn-action-view" data-id="${branch.id}" aria-label="View details for ${escapeHtml(branch.name)}">
                View
              </button>
              ${isSuperAdmin ? `
                <button type="button" class="btn btn-outline btn-sm btn-action-edit" data-id="${branch.id}" aria-label="Edit branch ${escapeHtml(branch.name)}">
                  Edit
                </button>
                ${statusActionBtn}
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    branchesTbody.innerHTML = rowsHtml;
  }

  /**
   * Opens the Add Branch modal dialog (Super Admin only).
   */
  function openAddModal() {
    hideModalAlert();
    modalBranchTitle.textContent = 'Add New Branch';

    fieldBranchId.value = '';
    fieldCode.value = '';
    fieldCode.disabled = false;
    fieldName.value = '';
    fieldAddress1.value = '';
    fieldAddress2.value = '';
    fieldCity.value = '';
    fieldState.value = '';
    fieldPostal.value = '';
    fieldCountry.value = 'India';
    fieldPhone.value = '';
    fieldEmail.value = '';
    fieldActive.checked = true;

    btnSaveText.textContent = 'Create Branch';
    btnSaveSpinner.style.display = 'none';
    btnSaveBranch.disabled = false;
    isSubmitting = false;

    modalBranchOverlay.style.display = 'flex';
    modalBranchOverlay.classList.add('active');
    fieldCode.focus();
  }

  /**
   * Opens the Edit Branch modal dialog (Super Admin only).
   */
  function openEditModal(branchId) {
    hideModalAlert();
    modalBranchTitle.textContent = 'Edit Branch Location';

    const id = parseInt(branchId, 10);
    const branch = allBranches.find(b => b.id === id);

    if (!branch) {
      showNotification('Branch record not found.');
      return;
    }

    fieldBranchId.value = branch.id;
    fieldCode.value = branch.code || '';
    fieldCode.disabled = false; // Backend allows editing code if unique
    fieldName.value = branch.name || '';
    fieldAddress1.value = branch.address_line1 || '';
    fieldAddress2.value = branch.address_line2 || '';
    fieldCity.value = branch.city || '';
    fieldState.value = branch.state || '';
    fieldPostal.value = branch.postal_code || '';
    fieldCountry.value = branch.country || 'India';
    fieldPhone.value = branch.phone || '';
    fieldEmail.value = branch.email || '';
    fieldActive.checked = Boolean(branch.is_active);

    btnSaveText.textContent = 'Update Branch';
    btnSaveSpinner.style.display = 'none';
    btnSaveBranch.disabled = false;
    isSubmitting = false;

    modalBranchOverlay.style.display = 'flex';
    modalBranchOverlay.classList.add('active');
    fieldName.focus();
  }

  function closeBranchModal() {
    modalBranchOverlay.classList.remove('active');
    modalBranchOverlay.style.display = 'none';
    hideModalAlert();
  }

  /**
   * Opens the View Branch details modal (Read-Only).
   */
  function openViewModal(branchId) {
    const id = parseInt(branchId, 10);
    const branch = allBranches.find(b => b.id === id);

    if (!branch) {
      showNotification('Branch record not found.');
      return;
    }

    const isDemo = (branch.name || '').includes('[DEMO / TEST]') || (branch.code || '').startsWith('DEMO-');

    viewBranchCode.textContent = branch.code || '—';
    viewBranchName.textContent = branch.name || '—';
    viewBranchCity.textContent = branch.city || '—';
    viewBranchStateCountry.textContent = `${branch.state || '—'}, ${branch.country || 'India'}`;
    viewBranchPostal.textContent = branch.postal_code || '—';
    viewBranchId.textContent = `#${branch.id}`;

    // Full Address formatting
    const addressLines = [
      branch.address_line1,
      branch.address_line2,
      `${branch.city}, ${branch.state} - ${branch.postal_code}`,
      branch.country || 'India'
    ].filter(Boolean);

    viewBranchFullAddress.innerHTML = addressLines.map(l => `<div>${escapeHtml(l)}</div>`).join('');
    viewBranchPhone.textContent = branch.phone || 'None provided';
    viewBranchEmail.textContent = branch.email || 'None provided';
    viewBranchCreated.textContent = formatDate(branch.created_at);
    viewBranchUpdated.textContent = formatDate(branch.updated_at);

    modalViewStatusBadge.innerHTML = renderStatusBadge(branch.is_active);
    modalViewDemoBadge.innerHTML = isDemo ? '<span class="badge-demo">Demo Record</span>' : '';
    modalViewFooterInfo.textContent = `Branch ID: #${branch.id} • Code: ${branch.code}`;

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
  function openConfirmStatusModal(branchId, action) {
    const id = parseInt(branchId, 10);
    const branch = allBranches.find(b => b.id === id);

    if (!branch) {
      showNotification('Branch record not found.');
      return;
    }

    currentTargetBranch = { ...branch, targetAction: action };
    confirmTargetBranchName.textContent = branch.name;
    confirmTargetBranchCode.textContent = branch.code;

    if (action === 'deactivate') {
      modalConfirmTitle.textContent = 'Confirm Branch Deactivation';
      confirmWarningTitle.textContent = 'Deactivating Branch Location';
      confirmWarningText.textContent = 'Deactivating this branch will hide it from the public active branch directory and prevent prospective students from selecting it on new enquiry forms. Existing historical enquiry records assigned to this branch are fully preserved in the database. You can reactivate this branch at any time.';
      confirmWarningBox.style.backgroundColor = '#fffbeb';
      confirmWarningBox.style.borderColor = '#fde68a';
      confirmWarningBox.style.color = '#92400e';
      btnStatusBtnText.textContent = 'Confirm Deactivation';
      btnExecuteBranchStatus.className = 'btn btn-danger btn-sm';
    } else {
      modalConfirmTitle.textContent = 'Confirm Branch Reactivation';
      confirmWarningTitle.textContent = 'Reactivating Branch Location';
      confirmWarningText.textContent = 'Reactivating this branch will restore its public visibility on the website directory and re-enable applicant routing for this campus center.';
      confirmWarningBox.style.backgroundColor = '#ecfdf5';
      confirmWarningBox.style.borderColor = '#a7f3d0';
      confirmWarningBox.style.color = '#065f46';
      btnStatusBtnText.textContent = 'Confirm Reactivation';
      btnExecuteBranchStatus.className = 'btn btn-primary btn-sm';
    }

    btnStatusSpinner.style.display = 'none';
    btnExecuteBranchStatus.disabled = false;

    modalConfirmOverlay.style.display = 'flex';
    modalConfirmOverlay.classList.add('active');
  }

  function closeConfirmModal() {
    modalConfirmOverlay.classList.remove('active');
    modalConfirmOverlay.style.display = 'none';
    currentTargetBranch = null;
  }

  /**
   * Executes the status toggle via PATCH /api/branches/:id/status.
   */
  async function executeStatusChange() {
    if (!currentTargetBranch || isSubmitting) return;

    try {
      isSubmitting = true;
      btnStatusSpinner.style.display = 'inline-block';
      btnExecuteBranchStatus.disabled = true;

      const targetActive = currentTargetBranch.targetAction === 'activate';
      const response = await window.adminApi.toggleBranchStatus(currentTargetBranch.id, targetActive);

      closeConfirmModal();
      showNotification(response.message || (targetActive ? 'Branch activated successfully.' : 'Branch deactivated successfully.'));
      await loadBranches();
    } catch (err) {
      console.error('Failed to change branch status:', err);
      alert(err.message || 'Failed to update branch status. Please try again.');
    } finally {
      isSubmitting = false;
      btnStatusSpinner.style.display = 'none';
      btnExecuteBranchStatus.disabled = false;
    }
  }

  /**
   * Validates form and saves new or updated branch record.
   */
  async function saveBranch() {
    if (isSubmitting) return;
    hideModalAlert();

    const code = fieldCode.value.trim().toUpperCase();
    const name = fieldName.value.trim();
    const address1 = fieldAddress1.value.trim();
    const address2 = fieldAddress2.value.trim();
    const city = fieldCity.value.trim();
    const state = fieldState.value.trim();
    const postal = fieldPostal.value.trim();
    const country = fieldCountry.value.trim() || 'India';
    const phone = fieldPhone.value.trim();
    const email = fieldEmail.value.trim();
    const isActive = fieldActive.checked;

    // 1. Code Validation
    if (!code || !/^[A-Za-z0-9_-]{2,20}$/.test(code)) {
      showModalAlert('Branch code is required and must be between 2 and 20 alphanumeric characters, hyphens, or underscores (e.g. BR-JAL-01).');
      fieldCode.focus();
      return;
    }

    // 2. Name Validation
    if (!name || name.length < 2 || name.length > 100) {
      showModalAlert('Branch name is required and must be between 2 and 100 characters.');
      fieldName.focus();
      return;
    }

    // 3. Address Line 1 Validation
    if (!address1 || address1.length < 3 || address1.length > 255) {
      showModalAlert('Address line 1 is required and must be between 3 and 255 characters.');
      fieldAddress1.focus();
      return;
    }

    // 4. Address Line 2 Validation (Optional)
    if (address2.length > 255) {
      showModalAlert('Address line 2 must not exceed 255 characters.');
      fieldAddress2.focus();
      return;
    }

    // 5. City Validation
    if (!city || city.length < 2 || city.length > 100) {
      showModalAlert('City is required and must be between 2 and 100 characters.');
      fieldCity.focus();
      return;
    }

    // 6. State Validation
    if (!state || state.length < 2 || state.length > 100) {
      showModalAlert('State is required and must be between 2 and 100 characters.');
      fieldState.focus();
      return;
    }

    // 7. Postal Code Validation
    if (!postal || !/^[A-Za-z0-9\s-]{3,20}$/.test(postal)) {
      showModalAlert('Postal code is required and must be between 3 and 20 alphanumeric characters.');
      fieldPostal.focus();
      return;
    }

    // 8. Country Validation
    if (country.length > 100) {
      showModalAlert('Country must not exceed 100 characters.');
      fieldCountry.focus();
      return;
    }

    // 9. Phone Validation (Optional)
    if (phone && !/^[+0-9\s-()]{6,30}$/.test(phone)) {
      showModalAlert('Phone number format is invalid. Must be between 6 and 30 characters (e.g. +91-181-0000000).');
      fieldPhone.focus();
      return;
    }

    // 10. Email Validation (Optional)
    if (email && (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      showModalAlert('Email address format is invalid.');
      fieldEmail.focus();
      return;
    }

    const payload = {
      code,
      name,
      address_line1: address1,
      address_line2: address2.length > 0 ? address2 : null,
      city,
      state,
      postal_code: postal,
      country,
      phone: phone.length > 0 ? phone : null,
      email: email.length > 0 ? email : null,
      is_active: isActive
    };

    const editId = fieldBranchId.value ? parseInt(fieldBranchId.value, 10) : null;

    try {
      isSubmitting = true;
      btnSaveSpinner.style.display = 'inline-block';
      btnSaveBranch.disabled = true;

      let response;
      if (editId) {
        response = await window.adminApi.updateBranch(editId, payload);
      } else {
        response = await window.adminApi.createBranch(payload);
      }

      closeBranchModal();
      showNotification(response.message || (editId ? 'Branch updated successfully.' : 'Branch created successfully.'));
      await loadBranches();
    } catch (err) {
      console.error('Failed to save branch:', err);

      // Handle duplicate code (HTTP 409 Conflict)
      if (err.status === 409) {
        showModalAlert(`Conflict: A branch with code "${escapeHtml(code)}" already exists. Please choose a different unique branch code.`);
        fieldCode.focus();
      } else if (err.status === 400) {
        showModalAlert(err.message || 'Invalid input. Please check the required fields.');
      } else if (err.status === 403) {
        showModalAlert('Access denied: You do not have permission to manage branches.');
      } else {
        showModalAlert(err.message || 'An unexpected error occurred while saving.');
      }
    } finally {
      isSubmitting = false;
      btnSaveSpinner.style.display = 'none';
      btnSaveBranch.disabled = false;
    }
  }

  /**
   * Resets all search and inactive filters.
   */
  function clearFilters() {
    filterSearch.value = '';
    if (filterIncludeInactive) {
      filterIncludeInactive.checked = false;
    }
    loadBranches();
  }

  /**
   * Attaches event listeners to the DOM.
   */
  function attachEventListeners() {
    btnRefresh.addEventListener('click', loadBranches);
    btnAddBranch.addEventListener('click', openAddModal);

    filterSearch.addEventListener('input', () => {
      renderTable();
    });

    if (filterIncludeInactive) {
      filterIncludeInactive.addEventListener('change', () => {
        loadBranches();
      });
    }

    btnClearFilters.addEventListener('click', clearFilters);
    btnEmptyClearFilters.addEventListener('click', clearFilters);
    btnRetryBranches.addEventListener('click', loadBranches);

    // Code input uppercase auto-format
    fieldCode.addEventListener('input', function () {
      this.value = this.value.toUpperCase();
    });

    // Add / Edit Modal buttons
    btnSaveBranch.addEventListener('click', saveBranch);
    btnCloseBranchModal.addEventListener('click', closeBranchModal);
    btnCancelBranch.addEventListener('click', closeBranchModal);

    // View Modal buttons
    btnCloseViewModal.addEventListener('click', closeViewModal);
    btnCloseViewFooter.addEventListener('click', closeViewModal);

    // Status Confirmation Modal buttons
    btnCloseConfirmModal.addEventListener('click', closeConfirmModal);
    btnCancelConfirm.addEventListener('click', closeConfirmModal);
    btnExecuteBranchStatus.addEventListener('click', executeStatusChange);

    // Event delegation for table action buttons
    branchesTbody.addEventListener('click', function (e) {
      const target = e.target.closest('button');
      if (!target) return;

      const branchId = target.getAttribute('data-id');
      if (!branchId) return;

      if (target.classList.contains('btn-action-view')) {
        openViewModal(branchId);
      } else if (target.classList.contains('btn-action-edit')) {
        openEditModal(branchId);
      } else if (target.classList.contains('btn-action-toggle-status')) {
        const action = target.getAttribute('data-action');
        openConfirmStatusModal(branchId, action);
      }
    });

    // Close modals on clicking overlay backdrop
    [modalBranchOverlay, modalViewOverlay, modalConfirmOverlay].forEach(overlay => {
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
        if (modalBranchOverlay.classList.contains('active')) closeBranchModal();
        if (modalViewOverlay.classList.contains('active')) closeViewModal();
        if (modalConfirmOverlay.classList.contains('active')) closeConfirmModal();
      }
    });
  }

  /**
   * Main Module Initialization.
   */
  async function init() {
    try {
      currentAdmin = await window.authGuard.init({ pageTitle: 'Branch Management' });

      if (!currentAdmin) return;

      // Strict Role Check: Branch Management operations are strictly restricted to Super Admin
      if (currentAdmin.role !== 'super_admin') {
        console.warn(`[RBAC] Access to /admin/branches.html restricted for role: ${currentAdmin.role}`);
        accessRestrictedView.style.display = 'block';
        branchesManagementView.style.display = 'none';
        return;
      }

      // Authorized Super Admin: display management interface
      accessRestrictedView.style.display = 'none';
      branchesManagementView.style.display = 'block';

      attachEventListeners();
      await loadBranches();
    } catch (err) {
      console.error('Branch management initialization failed:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
