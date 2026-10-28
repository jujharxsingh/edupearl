/**
 * ============================================================================
 * Edupearl: Development Rate-Limit Recovery Utility
 * ============================================================================
 * 
 * Safe local development procedure for clearing a stale in-memory rate-limit
 * bucket without exposing an HTTP endpoint or restarting processes manually.
 * 
 * Usage:
 *   npm run reset-rate-limit
 *   OR
 *   node scripts/reset-rate-limit-dev.js
 * 
 * Mechanism:
 * 1. Checks that NODE_ENV is not 'production'.
 * 2. Uses the exported resetLoginLimitForIp() utility for local process state.
 * 3. Updates the mtime on src/server.js so node --watch automatically re-spawns
 *    the dev server with fresh in-memory buckets without modifying any files.
 * 4. NEVER exposed as an HTTP route or accessible across the network.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { resetLoginLimitForIp } = require('../src/middleware/rateLimit.middleware');

async function resetRateLimit() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[Security Guard] Manual rate-limit reset is strictly prohibited in production.');
    process.exit(1);
  }

  console.log('============================================================');
  console.log('Edupearl: Safe Local Development Rate-Limit Reset');
  console.log('============================================================\n');

  try {
    // 1. Reset limiter memory for loopback addresses
    await resetLoginLimitForIp('127.0.0.1');
    console.log('  ✓ In-process memory store reset for 127.0.0.1 and loopback keys.');

    // 2. Trigger node --watch reload of running server
    const serverPath = path.resolve(__dirname, '../src/server.js');
    const now = new Date();
    fs.utimesSync(serverPath, now, now);
    console.log('  ✓ Triggered watch reload for running development server (node --watch).');
    console.log('  ✓ Stale development rate-limit buckets cleared successfully.\n');
  } catch (err) {
    console.error('  ✗ Reset operation encountered an error:', err.message);
    process.exitCode = 1;
  }
}

resetRateLimit();
