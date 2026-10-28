/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Express Application Configuration
 * ============================================================================
 * 
 * Configures global middleware, API routes, 404 handler, and centralized
 * error-handling middleware.
 * ============================================================================
 */

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const branchRoutes = require('./routes/branch.routes');
const serviceRoutes = require('./routes/service.routes');
const enquiryRoutes = require('./routes/enquiry.routes');

const app = express();

// Enable reverse proxy trust in production (Render, Railway, Koyeb, etc.)
// Ensures req.ip, X-Forwarded-Proto, and secure HTTPS cookies function correctly behind SSL reverse proxies.
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ============================================================================
// Core Middleware
// ============================================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ============================================================================
// API Route Registrations
// ============================================================================
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/enquiries', enquiryRoutes);

// ============================================================================
// Public Page Route Aliases
// ============================================================================
app.get('/courses', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/courses.html'));
});

app.get('/services', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/services.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/about.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/contact.html'));
});

app.get('/select-branch', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/select-branch.html'));
});

// ============================================================================
// Static Frontend Files
// ============================================================================
app.use(express.static(path.join(__dirname, '../public')));

// ============================================================================
// 404 Handler for Undefined Routes
// ============================================================================
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// ============================================================================
// Centralized Error-Handling Middleware
// ============================================================================
// Express recognizes this as error-handling middleware because of 4 parameters (err, req, res, next)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Handle malformed JSON request bodies from express.json()
  if (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400) && 'body' in err) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Malformed JSON payload in request body.'
    });
  }

  console.error('[Internal Server Error]:', err.stack || err.message);

  // Return a generic safe message without exposing internal stack traces
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: 'An unexpected server error occurred.'
  });
});

module.exports = app;
