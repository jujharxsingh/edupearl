/**
 * ============================================================================
 * Edupearl Immigration Services and Language Point
 * Authentication & Layout Guard (Phase 1: Foundation)
 * ============================================================================
 * 
 * Protects administrative web views by validating the current session against
 * `GET /api/admin/me` and providing consistent, role-aware sidebar navigation.
 * 
 * Security Principles:
 * 1. The backend remains the authoritative security enforcement point.
 * 2. Unauthenticated visitors are redirected to `/admin/login.html`.
 * 3. Open-redirect prevention: strictly validates internal `/admin/` redirect targets.
 * 4. Hides branch management navigation from non-super_admin staff.
 * ============================================================================
 */

(function () {
  'use strict';

  /**
   * Sanitizes redirect parameter against Open Redirect and protocol-relative attacks.
   * 
   * @param {string} url - Unsanitized redirect path candidate
   * @returns {string} Safe internal admin path (defaults to '/admin/index.html')
   */
  function sanitizeRedirectUrl(url) {
    if (!url || typeof url !== 'string') {
      return '/admin/index.html';
    }

    const trimmed = url.trim();

    // Reject protocol-relative URLs (e.g. //evil.com), data/javascript URIs, and full URLs
    if (trimmed.startsWith('//') || trimmed.includes('\\') || trimmed.includes(':')) {
      return '/admin/index.html';
    }

    // Must be an internal path starting with /admin/
    if (trimmed.startsWith('/admin/')) {
      return trimmed;
    }

    return '/admin/index.html';
  }

  /**
   * Format role name for human-readable display.
   * 
   * @param {string} role - 'super_admin' | 'branch_admin' | 'counselor'
   * @returns {string} Formatted label
   */
  function formatRole(role) {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'branch_admin':
        return 'Branch Admin';
      case 'counselor':
        return 'Counselor';
      default:
        return role ? role.replace(/_/g, ' ') : 'Staff';
    }
  }

  /**
   * Handle administrator logout
   */
  async function handleLogout() {
    try {
      if (window.adminApi) {
        await window.adminApi.logout();
      } else {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      }
    } catch (err) {
      console.warn('Logout request encountered an error, redirecting to login regardless:', err);
    } finally {
      window.location.href = '/admin/login.html';
    }
  }

  /**
   * Builds and injects the shared role-aware administrative sidebar.
   * 
   * @param {object} admin - Authenticated admin profile { id, username, fullName, role, email }
   * @param {string} currentPath - Current window location pathname
   */
  function renderSidebar(admin, currentPath) {
    const sidebarEl = document.getElementById('admin-sidebar');
    if (!sidebarEl) return;

    const isSuperAdmin = admin.role === 'super_admin';
    const roleBadgeClass = `badge-role-${admin.role || 'counselor'}`;

    sidebarEl.innerHTML = `
      <div class="sidebar-header">
        <a href="/admin/index.html" class="sidebar-logo-link" aria-label="Edupearl Admin Dashboard">
          <img src="/images/Edu Pearl Education Logo.png" alt="Edupearl Logo" class="sidebar-logo-img">
        </a>
      </div>

      <div class="sidebar-user">
        <div class="sidebar-user-name" title="${admin.fullName || admin.username}">
          ${admin.fullName || admin.username}
        </div>
        <div class="sidebar-user-email" title="${admin.email || ''}">
          ${admin.email || ''}
        </div>
        <span class="badge ${roleBadgeClass}">
          ${formatRole(admin.role)}
        </span>
      </div>

      <ul class="sidebar-nav" role="navigation" aria-label="Admin Navigation">
        <li class="nav-heading">Management</li>

        <li class="nav-item ${currentPath.endsWith('/admin/') || currentPath.endsWith('/index.html') ? 'active' : ''}">
          <a href="/admin/index.html">
            <span class="nav-icon" aria-hidden="true">📊</span>
            <span>Dashboard</span>
          </a>
        </li>

        <li class="nav-item ${currentPath.includes('/enquiries') ? 'active' : ''}">
          <a href="/admin/enquiries.html">
            <span class="nav-icon" aria-hidden="true">📋</span>
            <span>Enquiries</span>
          </a>
        </li>

        <li class="nav-item ${currentPath.includes('/services') ? 'active' : ''}">
          <a href="/admin/services.html">
            <span class="nav-icon" aria-hidden="true">📚</span>
            <span>Services & Courses</span>
          </a>
        </li>

        ${isSuperAdmin ? `
          <li class="nav-item ${currentPath.includes('/branches') ? 'active' : ''}">
            <a href="/admin/branches.html">
              <span class="nav-icon" aria-hidden="true">🏢</span>
              <span>Branch Management</span>
            </a>
          </li>
        ` : ''}

        <li class="nav-heading" style="margin-top: 1rem;">System</li>

        <li class="nav-item">
          <a href="/" target="_blank" rel="noopener noreferrer">
            <span class="nav-icon" aria-hidden="true">🌐</span>
            <span>View Public Website ↗</span>
          </a>
        </li>
      </ul>

      <div class="sidebar-footer">
        <button type="button" class="btn-sidebar-logout" id="btn-logout" aria-label="Sign out of portal">
          <span aria-hidden="true">🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    `;

    // Attach logout event
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }
  }

  /**
   * Builds and injects the top app bar for mobile viewports.
   * 
   * @param {object} admin - Authenticated admin profile
   * @param {string} pageTitle - Page heading title
   */
  function renderTopbar(admin, pageTitle) {
    const topbarEl = document.getElementById('admin-topbar');
    if (!topbarEl) return;

    topbarEl.innerHTML = `
      <div class="topbar-left">
        <button type="button" class="mobile-sidebar-toggle" id="mobile-sidebar-toggle" aria-label="Open navigation menu" aria-expanded="false">
          ☰
        </button>
        <h1 class="page-title">${pageTitle || 'Admin Portal'}</h1>
      </div>
      <div class="topbar-right">
        <span class="badge badge-role-${admin.role || 'counselor'}">
          ${formatRole(admin.role)}
        </span>
      </div>
    `;

    // Mobile sidebar toggle handler
    const toggleBtn = document.getElementById('mobile-sidebar-toggle');
    const sidebar = document.getElementById('admin-sidebar');

    if (toggleBtn && sidebar) {
      let backdrop = document.querySelector('.sidebar-backdrop');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
      }

      const closeSidebar = () => {
        sidebar.classList.remove('open');
        backdrop.classList.remove('active');
        toggleBtn.setAttribute('aria-expanded', 'false');
      };

      toggleBtn.addEventListener('click', () => {
        const isOpen = sidebar.classList.toggle('open');
        backdrop.classList.toggle('active', isOpen);
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
      });

      backdrop.addEventListener('click', closeSidebar);
    }
  }

  /**
   * Main Auth Guard Initialization.
   * Validates active session on page load.
   */
  async function initAuthGuard(options = {}) {
    try {
      if (!window.adminApi) {
        throw new Error('adminApi client is not loaded. Ensure admin-api.js is included before auth-guard.js.');
      }

      const response = await window.adminApi.getMe(false);
      const admin = response.admin;

      if (!admin) {
        throw new Error('Invalid administrator profile received.');
      }

      // Store in memory for page scripts
      window.currentAdmin = admin;

      // Render shared UI components
      const currentPath = window.location.pathname;
      renderSidebar(admin, currentPath);
      renderTopbar(admin, options.pageTitle || document.title);

      // Trigger custom event for page-specific initialization
      window.dispatchEvent(new CustomEvent('adminAuthenticated', { detail: admin }));

      return admin;
    } catch (err) {
      console.warn('Session verification failed, redirecting to login:', err.message);
      const currentPath = window.location.pathname;
      const redirect = encodeURIComponent(currentPath + window.location.search);
      window.location.href = `/admin/login.html?redirect=${redirect}`;
    }
  }

  /**
   * Helper to display an informational toast or notification for upcoming phases.
   */
  window.showPhaseNotice = function (moduleName, phaseName) {
    let noticeEl = document.getElementById('phase-notice-toast');
    if (!noticeEl) {
      noticeEl = document.createElement('div');
      noticeEl.id = 'phase-notice-toast';
      noticeEl.className = 'phase-notice-toast';
      document.body.appendChild(noticeEl);
    }
    noticeEl.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">ℹ️</span>
        <div>
          <strong>${moduleName} (${phaseName})</strong>
          <p>This module will be implemented in ${phaseName} following Phase 2 approval.</p>
        </div>
      </div>
    `;
    noticeEl.classList.add('visible');
    setTimeout(() => {
      noticeEl.classList.remove('visible');
    }, 4000);
  };

  // Export helper functions to global namespace
  window.authGuard = {
    init: initAuthGuard,
    logout: handleLogout,
    sanitizeRedirectUrl: sanitizeRedirectUrl,
    formatRole: formatRole
  };
})();
