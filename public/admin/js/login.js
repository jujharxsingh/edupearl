/**
 * ============================================================================
 * Edupearl Immigration Services and Language Point
 * Staff Login Page Controller (Phase 1: Foundation)
 * ============================================================================
 * 
 * Handles login form submission, credential verification, rate limiting
 * feedback, show/hide password toggling, and authenticated redirection.
 * ============================================================================
 */

(function () {
  'use strict';

  const form = document.getElementById('login-form');
  const identifierInput = document.getElementById('identifier');
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('btn-toggle-password');
  const togglePasswordIcon = document.getElementById('toggle-password-icon');
  const submitBtn = document.getElementById('btn-login-submit');
  const submitText = document.getElementById('btn-submit-text');
  const submitSpinner = document.getElementById('btn-submit-spinner');
  const alertContainer = document.getElementById('login-alert-container');

  let isSubmitting = false;

  /**
   * Strictly sanitizes redirect URL against Open Redirect attacks.
   * Only permits safe internal paths under /admin/.
   */
  function sanitizeRedirectUrl(url) {
    if (!url || typeof url !== 'string') {
      return '/admin/index.html';
    }

    const trimmed = url.trim();

    // Reject protocol-relative URLs, javascript: URIs, and external schemes
    if (trimmed.startsWith('//') || trimmed.includes('\\') || trimmed.includes(':')) {
      return '/admin/index.html';
    }

    // Must be internal /admin/ path
    if (trimmed.startsWith('/admin/')) {
      return trimmed;
    }

    return '/admin/index.html';
  }

  /**
   * Displays an alert banner in the login card.
   * 
   * @param {'danger' | 'warning' | 'info' | 'success'} type
   * @param {string} title
   * @param {string} message
   */
  function showAlert(type, title, message) {
    if (!alertContainer) return;

    const icon = {
      danger: '⚠️',
      warning: '⏳',
      info: 'ℹ️',
      success: '✅'
    }[type] || 'ℹ️';

    alertContainer.innerHTML = `
      <div class="alert alert-${type}" role="alert">
        <span class="alert-icon" aria-hidden="true">${icon}</span>
        <div class="alert-content">
          <strong>${title}</strong>
          <div>${message}</div>
        </div>
      </div>
    `;
  }

  /**
   * Clears the alert banner.
   */
  function clearAlert() {
    if (alertContainer) {
      alertContainer.innerHTML = '';
    }
  }

  /**
   * Toggles submit button loading state.
   * 
   * @param {boolean} isLoading
   */
  function setLoading(isLoading) {
    if (!submitBtn) return;

    submitBtn.disabled = isLoading;
    if (identifierInput) identifierInput.disabled = isLoading;
    if (passwordInput) passwordInput.disabled = isLoading;

    if (isLoading) {
      submitText.textContent = 'Authenticating...';
      submitSpinner.style.display = 'inline-block';
    } else {
      submitText.textContent = 'Log In to Portal';
      submitSpinner.style.display = 'none';
    }
  }

  /**
   * Toggle password input visibility
   */
  function initPasswordToggle() {
    if (!togglePasswordBtn || !passwordInput) return;

    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
      togglePasswordBtn.setAttribute('aria-pressed', String(isPassword));
      togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      if (togglePasswordIcon) {
        togglePasswordIcon.textContent = isPassword ? '🙈' : '👁️';
      }
      passwordInput.focus();
    });
  }

  /**
   * Check if administrator is already logged in upon visiting login page.
   */
  async function checkExistingSession() {
    try {
      if (!window.adminApi) return;
      const response = await window.adminApi.getMe(true);
      if (response && response.admin) {
        // User already has a valid session -> redirect to target
        const params = new URLSearchParams(window.location.search);
        const target = sanitizeRedirectUrl(params.get('redirect'));
        window.location.href = target;
      }
    } catch {
      // Not logged in or session expired, normal login page behavior continues
    }
  }

  /**
   * Form submission handler
   */
  async function handleFormSubmit(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (isSubmitting) {
      return;
    }

    clearAlert();

    const identifier = identifierInput ? identifierInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    // Client-side presence validation
    if (!identifier || !password) {
      showAlert('danger', 'Missing Credentials', 'Please enter your username or email address and password.');
      if (!identifier && identifierInput) {
        identifierInput.focus();
      } else if (passwordInput) {
        passwordInput.focus();
      }
      return;
    }

    isSubmitting = true;
    setLoading(true);

    try {
      // 1. Submit login request (POST /api/auth/login)
      const loginResult = await window.adminApi.login(identifier, password);
      const admin = loginResult && loginResult.admin ? loginResult.admin : { username: identifier };

      showAlert('success', 'Authentication Successful', `Welcome, ${admin.fullName || admin.username}! Entering portal...`);

      // 2. Resolve redirect destination
      const params = new URLSearchParams(window.location.search);
      const target = sanitizeRedirectUrl(params.get('redirect'));

      setTimeout(() => {
        window.location.href = target;
      }, 400);
    } catch (err) {
      isSubmitting = false;
      setLoading(false);

      if (err.status === 429) {
        // Rate limit threshold exceeded
        showAlert(
          'warning',
          'Rate Limit Exceeded (HTTP 429)',
          err.message || 'Too many failed login attempts from this IP address. Please wait 15 minutes before trying again.'
        );
      } else if (err.status === 401) {
        // Bad credentials or inactive account
        showAlert('danger', 'Authentication Failed', err.message || 'Invalid username, email, or password.');
        if (passwordInput) {
          passwordInput.value = '';
          passwordInput.focus();
        }
      } else if (err.status === 400) {
        // Bad request / validation error
        showAlert('danger', 'Invalid Input', err.message || 'Please check your inputs and try again.');
      } else if (err.status === 0) {
        // Network connection error
        showAlert('danger', 'Connection Error', 'Unable to reach the server. Please verify your connection.');
      } else {
        // Generic unexpected error (safe message, no leak of stack traces)
        showAlert('danger', 'Server Error', 'An unexpected error occurred. Please try again shortly.');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Ensure form fields start completely empty on page load
    if (form) {
      form.reset();
    }
    if (identifierInput) {
      identifierInput.value = '';
    }
    if (passwordInput) {
      passwordInput.value = '';
    }

    initPasswordToggle();
    checkExistingSession();

    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }
  });
})();
