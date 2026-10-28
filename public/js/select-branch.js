/**
 * ============================================================================
 * Edupearl Immigration Services & Language Point
 * Initial Branch Selection Controller
 * ============================================================================
 * 
 * Manages dynamic branch fetching from GET /api/branches, rendering active
 * branch cards with name and location details, filtering, persistence of
 * the selected branch ID in localStorage and cookie, and safe continuation
 * to the public homepage.
 * ============================================================================
 */

(function () {
  'use strict';

  // DOM Elements
  const container = document.getElementById('branches-selection-container');
  const filterBar = document.getElementById('branch-filter-bar');
  const searchInput = document.getElementById('branch-search-input');
  const countBadge = document.getElementById('branch-count-badge');
  const currentBanner = document.getElementById('current-selection-container');
  const toggleBtn = document.getElementById('mobile-toggle');
  const navLinks = document.getElementById('nav-links');

  // Mobile menu toggle
  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // State
  let allBranches = [];

  /**
   * Determine safe relative continuation target URL.
   * Restricts redirects to relative paths to avoid open-redirect security risks.
   * @returns {string}
   */
  function getSafeRedirectUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      if (
        redirect &&
        redirect.startsWith('/') &&
        !redirect.startsWith('//') &&
        !redirect.includes('\\')
      ) {
        return redirect;
      }
    } catch (e) {}
    return '/';
  }

  /**
   * Sanitize string for secure HTML interpolation
   * @param {*} str 
   * @returns {string}
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
   * Render top banner if user already has an active selection in storage
   */
  function renderCurrentSelectionBanner() {
    if (!currentBanner) return;
    const currentId = api.getSelectedBranchId();
    if (!currentId) {
      currentBanner.style.display = 'none';
      return;
    }

    const currentBranch = allBranches.find(b => String(b.id) === String(currentId));
    const branchMeta = api.getSelectedBranch();
    const branchName = currentBranch
      ? currentBranch.name
      : (branchMeta && branchMeta.name ? branchMeta.name : `Branch #${currentId}`);

    currentBanner.style.display = 'block';
    currentBanner.innerHTML = `
      <div class="current-selection-banner" role="region" aria-label="Current Branch Selection">
        <div class="current-selection-text">
          <span>✓ Currently Selected Center:</span> <strong>${escapeHtml(branchName)}</strong>
        </div>
        <a href="${escapeHtml(getSafeRedirectUrl())}" class="btn btn-primary btn-sm" id="btn-continue-current">Continue to Home →</a>
      </div>
    `;
  }

  /**
   * Render branch cards dynamically into container
   * @param {Array<object>} branches 
   */
  function renderBranches(branches) {
    if (!container) return;

    if (branches.length === 0) {
      if (allBranches.length === 0) {
        api.renderEmpty(
          container,
          'No Active Branches Available',
          'There are currently no active branch locations available. Please contact our support team.'
        );
      } else {
        api.renderEmpty(
          container,
          'No Matching Centers Found',
          'No branch locations match your search query. Please try searching for another city or center name.'
        );
      }
      return;
    }

    const selectedId = String(api.getSelectedBranchId() || '');

    container.innerHTML = branches.map(b => {
      const isSelected = String(b.id) === selectedId;
      const addressParts = [b.address_line1, b.address_line2].filter(Boolean).join(', ');
      const locationLine = `${b.city}, ${b.state} - ${b.postal_code}`;

      return `
        <article class="branch-select-card ${isSelected ? 'selected-active' : ''}" 
                 data-branch-id="${b.id}" 
                 tabindex="0" 
                 role="button" 
                 aria-pressed="${isSelected}">
          <div class="branch-card-top">
            <span class="branch-code-pill">${escapeHtml(b.code)}</span>
            ${isSelected 
              ? '<span class="branch-selected-tag">✓ Selected</span>' 
              : '<span class="status-pill"><span class="status-dot"></span> Active</span>'
            }
          </div>

          <h3 class="branch-card-title">${escapeHtml(b.name)}</h3>
          <div class="branch-card-city">
            <span aria-hidden="true">📍</span> ${escapeHtml(b.city)}, ${escapeHtml(b.state)}
          </div>

          <div class="branch-info-list">
            <div class="branch-info-item">
              <span class="branch-info-icon" aria-hidden="true">🏢</span>
              <span>${escapeHtml(addressParts)}<br>${escapeHtml(locationLine)}${b.country && b.country !== 'India' ? `, ${escapeHtml(b.country)}` : ''}</span>
            </div>

            ${b.phone ? `
              <div class="branch-info-item">
                <span class="branch-info-icon" aria-hidden="true">📞</span>
                <span>${escapeHtml(b.phone)}</span>
              </div>
            ` : ''}

            ${b.email ? `
              <div class="branch-info-item">
                <span class="branch-info-icon" aria-hidden="true">✉️</span>
                <span>${escapeHtml(b.email)}</span>
              </div>
            ` : ''}
          </div>

          <div class="branch-select-action">
            <button type="button" 
                    class="btn ${isSelected ? 'btn-secondary' : 'btn-primary'} btn-select" 
                    data-branch-id="${b.id}">
              ${isSelected ? 'Keep Center & Continue →' : 'Select Center & Continue →'}
            </button>
          </div>
        </article>
      `;
    }).join('');

    // Attach interaction listeners to cards and buttons
    container.querySelectorAll('.branch-select-card').forEach(card => {
      const branchId = card.getAttribute('data-branch-id');
      const selectBtn = card.querySelector('.btn-select');

      const handleSelection = (e) => {
        if (e) e.stopPropagation();
        selectBranch(branchId);
      };

      if (selectBtn) {
        selectBtn.addEventListener('click', handleSelection);
      }

      card.addEventListener('click', () => {
        selectBranch(branchId);
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectBranch(branchId);
        }
      });
    });
  }

  /**
   * Handle user selection of a branch:
   * 1. Persist branch ID and metadata in localStorage & cookie.
   * 2. Show brief tactile confirmation.
   * 3. Continue to homepage (or redirect target).
   * @param {string|number} branchId 
   */
  function selectBranch(branchId) {
    const branch = allBranches.find(b => String(b.id) === String(branchId));
    if (!branch) return;

    // Visual button state update
    const card = container.querySelector(`[data-branch-id="${branchId}"]`);
    if (card) {
      const btn = card.querySelector('.btn-select');
      if (btn) {
        btn.textContent = 'Selected! Loading...';
        btn.disabled = true;
      }
      card.classList.add('selected-active');
    }

    // Persist branch selection using centralized API helper
    api.setSelectedBranch(branch);

    // Continue to public homepage or requested relative URL
    const targetUrl = getSafeRedirectUrl();
    setTimeout(() => {
      window.location.href = targetUrl;
    }, 180);
  }

  /**
   * Search / Filter input listener
   */
  function filterBranches() {
    const query = (searchInput?.value || '').trim().toLowerCase();
    let filtered = allBranches;
    if (query) {
      filtered = allBranches.filter(b => {
        return (
          (b.name && b.name.toLowerCase().includes(query)) ||
          (b.city && b.city.toLowerCase().includes(query)) ||
          (b.state && b.state.toLowerCase().includes(query)) ||
          (b.code && b.code.toLowerCase().includes(query)) ||
          (b.address_line1 && b.address_line1.toLowerCase().includes(query))
        );
      });
    }

    if (countBadge) {
      countBadge.textContent = `Showing ${filtered.length} active center${filtered.length === 1 ? '' : 's'}`;
    }

    renderBranches(filtered);
  }

  if (searchInput) {
    searchInput.addEventListener('input', filterBranches);
  }

  /**
   * Load active branches dynamically from the public API
   */
  async function loadBranches() {
    api.renderLoading(container, 'Loading available branch locations...');
    if (filterBar) filterBar.style.display = 'none';

    try {
      // Calls GET /api/branches (Public read: active only, no includeInactive)
      const data = await api.getBranches();
      allBranches = (data && Array.isArray(data.branches)) ? data.branches : [];

      if (allBranches.length === 0) {
        if (filterBar) filterBar.style.display = 'none';
        api.renderEmpty(
          container,
          'No Active Branches Available',
          'There are currently no active branch locations registered in the system.'
        );
        return;
      }

      if (filterBar) filterBar.style.display = 'flex';
      if (countBadge) {
        countBadge.textContent = `Showing ${allBranches.length} active center${allBranches.length === 1 ? '' : 's'}`;
      }

      renderCurrentSelectionBanner();
      renderBranches(allBranches);
    } catch (err) {
      console.error('Failed to load branches:', err);
      if (filterBar) filterBar.style.display = 'none';
      api.renderError(
        container,
        err.message || 'Unable to load branch locations. Please try again.',
        loadBranches
      );
    }
  }

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', () => {
    loadBranches();
  });
})();
