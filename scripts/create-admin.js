/**
 * ============================================================================
 * Edu Pearl Immigration Services & Language Point
 * Interactive Super Administrator Setup Script
 * ============================================================================
 * 
 * Usage:
 *   npm run create-admin
 *   OR
 *   node scripts/create-admin.js
 * 
 * Security Guarantees:
 * 1. Passwords are typed with terminal echo DISABLED (characters are hidden).
 * 2. Passwords are never stored in plaintext or printed to console/logs.
 * 3. Salted one-way hashing using bcryptjs with 12 salt rounds.
 * 4. Checks for existing duplicate usernames or email addresses.
 * 5. Role is explicitly assigned as 'super_admin'.
 * 6. Connection pool is closed gracefully upon completion or failure.
 * ============================================================================
 */

const path = require('path');
const readline = require('readline');
const bcrypt = require('bcryptjs');

// Ensure environment variables are loaded
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = require('../src/config/db');

/**
 * Prompts for visible user input via readline
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompts for hidden password input without terminal echo (Native Node.js)
 */
function askHiddenQuestion(query) {
  return new Promise((resolve) => {
    process.stdout.write(query);

    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;

    stdin.resume();
    if (stdin.setRawMode) {
      stdin.setRawMode(true);
    }
    stdin.setEncoding('utf8');

    let input = '';

    const onData = (chunk) => {
      for (let i = 0; i < chunk.length; i++) {
        const char = chunk[i];

        if (char === '\r' || char === '\n' || char === '\u0004') {
          // Enter pressed
          cleanup();
          process.stdout.write('\n');
          resolve(input);
          return;
        } else if (char === '\u0003') {
          // Ctrl+C pressed
          cleanup();
          process.stdout.write('\n\n[Operation aborted by user]\n');
          process.exit(0);
        } else if (char === '\u0008' || char === '\x7f') {
          // Backspace / Delete
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
        } else {
          // Printable characters
          input += char;
        }
      }
    };

    const cleanup = () => {
      stdin.removeListener('data', onData);
      if (stdin.setRawMode) {
        stdin.setRawMode(wasRaw || false);
      }
      stdin.pause();
    };

    stdin.on('data', onData);
  });
}

async function createAdmin() {
  console.log('============================================================');
  console.log('Edu Pearl Immigration Services & Language Point');
  console.log('Administrator Account Setup Utility');
  console.log('============================================================\n');

  try {
    // 1. Prompt for Full Name
    const fullName = await askQuestion('Enter Full Name: ');
    if (!fullName || fullName.length < 2) {
      console.error('❌ Error: Full name must be at least 2 characters.');
      process.exitCode = 1;
      return;
    }

    // 2. Prompt for Username
    const username = await askQuestion('Enter Username (3-50 chars, alphanumeric/underscore): ');
    const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
    if (!usernameRegex.test(username)) {
      console.error('❌ Error: Invalid username format. Must be 3-50 characters using letters, numbers, hyphens, or underscores.');
      process.exitCode = 1;
      return;
    }

    // 3. Prompt for Email
    const email = await askQuestion('Enter Email Address: ');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('❌ Error: Invalid email address format.');
      process.exitCode = 1;
      return;
    }

    // 4. Duplicate Check (Username & Email)
    const [existing] = await pool.query(
      'SELECT id, username, email FROM admins WHERE username = ? OR email = ? LIMIT 1',
      [username, email]
    );

    if (existing.length > 0) {
      const match = existing[0];
      if (match.username.toLowerCase() === username.toLowerCase()) {
        console.error(`❌ Error: Username "${username}" is already registered.`);
      } else {
        console.error(`❌ Error: Email "${email}" is already registered.`);
      }
      process.exitCode = 1;
      return;
    }

    // 5. Prompt for Password (Hidden)
    const password = await askHiddenQuestion('Enter Secure Password (min 8 chars, 1 letter, 1 number): ');
    if (password.length < 8) {
      console.error('❌ Error: Password must be at least 8 characters long.');
      process.exitCode = 1;
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      console.error('❌ Error: Password must contain at least one letter and one number.');
      process.exitCode = 1;
      return;
    }

    // 6. Confirm Password (Hidden)
    const confirmPassword = await askHiddenQuestion('Confirm Password: ');
    if (password !== confirmPassword) {
      console.error('❌ Error: Passwords do not match.');
      process.exitCode = 1;
      return;
    }

    // 7. Salt and Hash the Password using bcryptjs
    console.log('\nHashing password securely with bcrypt (12 salt rounds)...');
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // 8. Insert into admins table
    const [result] = await pool.query(
      `INSERT INTO admins (username, email, password_hash, full_name, role, is_active)
       VALUES (?, ?, ?, ?, 'super_admin', TRUE)`,
      [username, email, passwordHash, fullName]
    );

    console.log('------------------------------------------------------------');
    console.log('✅ Administrator Account Created Successfully!');
    console.log(` • Admin ID:   ${result.insertId}`);
    console.log(` • Full Name:  ${fullName}`);
    console.log(` • Username:   ${username}`);
    console.log(` • Email:      ${email}`);
    console.log(' • Role:       super_admin');
    console.log(' • Status:     Active');
    console.log(' • Password:   [SECURELY STORED AS HASH - HIDDEN]');
    console.log('============================================================');
  } catch (error) {
    console.error('❌ Failed to create administrator account:');
    console.error(` • Message: ${error.message}`);
    process.exitCode = 1;
  } finally {
    // Always close the database connection pool cleanly
    await pool.end();
  }
}

createAdmin();
