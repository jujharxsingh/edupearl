/**
 * ============================================================================
 * Edupearl Immigration Services and Language Point
 * Centralized API & Utility Helper
 * ============================================================================
 * 
 * Provides beginner-friendly asynchronous fetch wrappers for interacting with
 * the backend REST API endpoints.
 * ============================================================================
 */

const api = {
  /**
   * Generic Fetch Wrapper
   * @param {string} endpoint - Relative API URL (e.g. '/api/services')
   * @param {object} options - Fetch options
   * @returns {Promise<object>} Parsed JSON response
   */
  async request(endpoint, options = {}) {
    const config = {
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      },
      ...options
    };

    try {
      const response = await fetch(endpoint, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.message || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (!err.status) {
        // Network connection error
        const netErr = new Error('Unable to connect to server. Please check your network connection.');
        netErr.status = 0;
        throw netErr;
      }
      throw err;
    }
  },

  /**
   * Fetch services and courses
   * @param {object} params - Optional query filters { category, featured }
   */
  async getServices(params = {}) {
    const query = new URLSearchParams();
    if (params.category) query.append('category', params.category);
    if (params.featured !== undefined) query.append('featured', String(params.featured));

    const qs = query.toString();
    const url = `/api/services${qs ? `?${qs}` : ''}`;
    return this.request(url);
  },

  /**
   * Fetch a single service by unique URL slug
   * @param {string} slug
   */
  async getServiceBySlug(slug) {
    return this.request(`/api/services/slug/${encodeURIComponent(slug)}`);
  },

  /**
   * Fetch public active branches
   */
  async getBranches() {
    return this.request('/api/branches');
  },

  /**
   * Submit client enquiry to backend
   * Route: POST /api/enquiries
   * @param {object} payload - Form payload (full_name, email, phone, city, target_country, message, etc.)
   */
  async submitEnquiry(payload) {
    return this.request('/api/enquiries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  },

  /**
   * Utility: Render Loading Spinner
   */
  renderLoading(container, text = 'Loading data...') {
    if (!container) return;
    container.innerHTML = `
      <div class="spinner-wrapper" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p>${text}</p>
      </div>
    `;
  },

  /**
   * Utility: Render Error State with optional retry callback
   */
  renderError(container, message = 'Failed to load content.', onRetry = null) {
    if (!container) return;
    const retryBtnHtml = onRetry ? `<button class="btn btn-primary btn-sm btn-retry" type="button">Retry</button>` : '';
    container.innerHTML = `
      <div class="error-state" role="alert">
        <h3>Unable to Load Content</h3>
        <p>${message}</p>
        ${retryBtnHtml}
      </div>
    `;

    if (onRetry) {
      const btn = container.querySelector('.btn-retry');
      if (btn) btn.addEventListener('click', onRetry);
    }
  },

  /**
   * Utility: Render Empty State
   */
  renderEmpty(container, title = 'No Items Available', message = 'There are no active records to display at this time.') {
    if (!container) return;
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">📋</div>
        <h3>${title}</h3>
        <p>${message}</p>
      </div>
    `;
  },

  /**
   * Utility: Humanize category strings
   */
  formatCategory(category) {
    if (category === 'language_course') return 'Language Preparation';
    if (category === 'immigration_service') return 'Visa Consultation';
    return category || 'General';
  },

  /**
   * Utility: Category badge style class
   */
  getCategoryBadgeClass(category) {
    return category === 'language_course' ? 'badge-amber' : 'badge-primary';
  },

  /**
   * Storage key constants for visitor branch selection
   */
  STORAGE_KEYS: {
    SELECTED_BRANCH_ID: 'edupearl_selected_branch_id',
    SELECTED_BRANCH_NAME: 'edupearl_selected_branch_name',
    SELECTED_BRANCH_CODE: 'edupearl_selected_branch_code',
    SELECTED_BRANCH_CITY: 'edupearl_selected_branch_city'
  },

  /**
   * Helper to parse cookie value by name
   * @param {string} name - Cookie name
   * @returns {string|null}
   */
  getCookie(name) {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  },

  /**
   * Retrieve currently selected branch ID
   * Checks localStorage first, then cookie as fallback
   * @returns {string|null}
   */
  getSelectedBranchId() {
    try {
      const fromLocal = localStorage.getItem(this.STORAGE_KEYS.SELECTED_BRANCH_ID);
      if (fromLocal) return fromLocal;
    } catch (e) {}
    return this.getCookie(this.STORAGE_KEYS.SELECTED_BRANCH_ID);
  },

  /**
   * Retrieve full selected branch metadata from client storage
   * @returns {object|null}
   */
  getSelectedBranch() {
    const id = this.getSelectedBranchId();
    if (!id) return null;
    let name = null;
    let code = null;
    let city = null;
    try {
      name = localStorage.getItem(this.STORAGE_KEYS.SELECTED_BRANCH_NAME);
      code = localStorage.getItem(this.STORAGE_KEYS.SELECTED_BRANCH_CODE);
      city = localStorage.getItem(this.STORAGE_KEYS.SELECTED_BRANCH_CITY);
    } catch (e) {}
    return { id, name, code, city };
  },

  /**
   * Store selected branch ID and metadata in client storage and cookie.
   * Compatible with existing application; does not store credentials or JWTs.
   * @param {object|number|string} branch - Branch object or branch ID
   */
  setSelectedBranch(branch) {
    if (!branch) return;
    const isObj = typeof branch === 'object' && branch !== null;
    const id = String(isObj ? branch.id : branch);
    const name = isObj && branch.name ? String(branch.name) : '';
    const code = isObj && branch.code ? String(branch.code) : '';
    const city = isObj && branch.city ? String(branch.city) : '';

    try {
      localStorage.setItem(this.STORAGE_KEYS.SELECTED_BRANCH_ID, id);
      if (name) localStorage.setItem(this.STORAGE_KEYS.SELECTED_BRANCH_NAME, name);
      if (code) localStorage.setItem(this.STORAGE_KEYS.SELECTED_BRANCH_CODE, code);
      if (city) localStorage.setItem(this.STORAGE_KEYS.SELECTED_BRANCH_CITY, city);
    } catch (e) {
      console.warn('Unable to persist branch selection to localStorage:', e);
    }

    if (typeof document !== 'undefined') {
      document.cookie = `${this.STORAGE_KEYS.SELECTED_BRANCH_ID}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
    }
  },

  /**
   * Clear selected branch
   */
  clearSelectedBranch() {
    try {
      localStorage.removeItem(this.STORAGE_KEYS.SELECTED_BRANCH_ID);
      localStorage.removeItem(this.STORAGE_KEYS.SELECTED_BRANCH_NAME);
      localStorage.removeItem(this.STORAGE_KEYS.SELECTED_BRANCH_CODE);
      localStorage.removeItem(this.STORAGE_KEYS.SELECTED_BRANCH_CITY);
    } catch (e) {}
    if (typeof document !== 'undefined') {
      document.cookie = `${this.STORAGE_KEYS.SELECTED_BRANCH_ID}=; path=/; max-age=0; SameSite=Lax`;
    }
  },

  /**
   * WhatsApp Configuration
   * 
   * NOTE FOR LAUNCH CONFIGURATION:
   * Replace 'YOUR_WHATSAPP_NUMBER' with Edupearl's verified business number with
   * country code (e.g., '919876543210' for India +91).
   * While unconfigured, client clicks are safely intercepted with an advisory
   * message directing visitors to the Contact form rather than exposing a non-functional link.
   */
  WHATSAPP_CONFIG: {
    PHONE_NUMBER: '919115052624',
    DEFAULT_MESSAGE: encodeURIComponent('Hello Edupearl, I would like to enquire about courses and visa consultation.'),
    isConfigured() {
      return this.PHONE_NUMBER && 
             this.PHONE_NUMBER !== 'YOUR_WHATSAPP_NUMBER' && 
             !this.PHONE_NUMBER.includes('YOUR_');
    },
    getUrl() {
      if (!this.isConfigured()) return null;
      return `https://wa.me/${this.PHONE_NUMBER}?text=${this.DEFAULT_MESSAGE}`;
    }
  },

  /**
   * Safely initialize WhatsApp links across public pages
   */
  initWhatsAppLinks() {
    if (typeof document === 'undefined') return;
    const links = document.querySelectorAll('a[href*="wa.me"], a.nav-cta-whatsapp, a.btn-whatsapp');
    links.forEach(link => {
      if (this.WHATSAPP_CONFIG.isConfigured()) {
        link.href = this.WHATSAPP_CONFIG.getUrl();
        link.removeAttribute('title');
      } else {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          alert('Edupearl WhatsApp consultation is currently being connected. Please use our Contact page or enquiry form for immediate assistance.');
          window.location.href = '/contact.html';
        });
      }
    });
  },

  /**
   * Universal Floating Header & Mobile Menu Initialization
   */
  initFloatingHeader() {
    if (typeof document === 'undefined') return;

    const siteHeader = document.getElementById('site-header');
    if (siteHeader && !siteHeader._hasScrollInit) {
      siteHeader._hasScrollInit = true;
      const onScroll = () => {
        if (window.scrollY > 40) {
          siteHeader.classList.add('scrolled-pill');
        } else {
          siteHeader.classList.remove('scrolled-pill');
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    const toggleBtn = document.getElementById('mobile-toggle');
    const navWrap = document.querySelector('.header-nav-wrap');
    if (toggleBtn && navWrap && !toggleBtn._hasNavInit) {
      toggleBtn._hasNavInit = true;

      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = navWrap.classList.toggle('mobile-open');
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
      });

      // Close when clicking anywhere outside the header
      document.addEventListener('click', (e) => {
        if (siteHeader && !siteHeader.contains(e.target)) {
          navWrap.classList.remove('mobile-open');
          toggleBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Close when pressing Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navWrap.classList.contains('mobile-open')) {
          navWrap.classList.remove('mobile-open');
          toggleBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Close when clicking any nav link
      navWrap.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          navWrap.classList.remove('mobile-open');
          toggleBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }
  },

  /**
   * Initialize Global Scroll-Triggered Reveal Animations
   */
  initScrollReveal() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Respect user's reduced-motion preference
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const targets = document.querySelectorAll(
      '.reveal, .reveal-stagger, .pillar-card, .roadmap-card, .service-card, .course-card, .about-card, .trust-card'
    );

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.1
    });

    targets.forEach(el => {
      if (!el.classList.contains('is-visible')) {
        observer.observe(el);
      }
    });
  },

  /**
   * Initialize Interactive Form Feedback & Validation
   */
  initFormInteractions() {
    if (typeof document === 'undefined') return;
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const inputs = form.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.addEventListener('focus', () => {
          const group = input.closest('.form-group') || input.parentElement;
          if (group) group.classList.add('is-focused');
        });
        input.addEventListener('blur', () => {
          const group = input.closest('.form-group') || input.parentElement;
          if (group) group.classList.remove('is-focused');
          if (input.value && input.checkValidity && input.checkValidity()) {
            input.classList.add('is-valid');
            input.classList.remove('is-invalid');
          } else if (input.value && input.checkValidity && !input.checkValidity()) {
            input.classList.add('is-invalid');
            input.classList.remove('is-valid');
          }
        });
      });
    });
  },

  /**
   * Initialize Interactive Card Micro-Interactions (Restrained elevation)
   */
  initCardInteractions() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;

    const cards = document.querySelectorAll('.pillar-card, .roadmap-card, .branch-dir-card, .service-card, .course-card');
    cards.forEach(card => {
      if (card._hasCardInit) return;
      card._hasCardInit = true;
      card.addEventListener('mouseenter', () => {
        card.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease';
      });
    });
  },

  /**
   * Lightweight Background Video Observer:
   * 1. Pauses videos when far out of viewport (reducing GPU & CPU decoding load to near 0)
   * 2. Resumes videos smoothly right as they approach viewport (rootMargin: '250px')
   * 3. Pauses videos when user switches browser tabs to save battery and RAM
   */
  initVideoPerformance() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!('IntersectionObserver' in window)) return;

    const bgVideos = document.querySelectorAll('.section-video-element, .hero-video-bg');
    if (!bgVideos.length) return;

    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
          if (video.paused) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise.catch(() => {});
            }
          }
        } else {
          if (!video.paused) {
            video.pause();
          }
        }
      });
    }, {
      root: null,
      rootMargin: '250px 0px 250px 0px',
      threshold: 0
    });

    bgVideos.forEach(video => {
      videoObserver.observe(video);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        bgVideos.forEach(v => {
          if (!v.paused) v.pause();
        });
      }
    });
  }
};

// Automatically initialize WhatsApp, Header, Scroll, Video, and Interactive handlers
if (typeof document !== 'undefined') {
  const initAll = () => {
    api.initWhatsAppLinks();
    api.initFloatingHeader();
    api.initScrollReveal();
    api.initFormInteractions();
    api.initCardInteractions();
    api.initVideoPerformance();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
}

