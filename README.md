# Edu Pearl Immigration Services & Language Point

> **BCA 5th-Semester Capstone Project | Lovely Professional University (LPU)**  
> **Milestone 1: Project Initialization, Security Hardening & Database Connectivity**

---

## 1. Project Overview

**Edu Pearl Immigration Services & Language Point** is a professional web portal designed for an immigration consultancy and language training institute. 

Milestone 1 sets up the professional backend foundation, database connectivity via connection pooling, and strict database security isolation (avoiding `root` user access).

---

## 2. Security Principle: Why We Never Use MySQL `root`

In industry and software engineering best practices:
- **Principle of Least Privilege (PoLP):** An application should only possess the minimum permissions it needs to perform its job.
- **Risk Mitigation:** If an application connected with `root` ever encounters an SQL Injection vulnerability, an attacker would have full administrative control over the entire MySQL server (including the ability to drop other databases, access system tables, or create users).
- **Dedicated Service User:** Creating a dedicated database user (e.g., `edupearl_user`) scoped strictly to `edupearl_db` ensures that even if credentials are compromised, damage is strictly confined to that single database.

---

## 3. Windows Setup & MySQL User Creation Guide

Follow these steps on your Windows machine:

### Step 1: Ensure Prerequisites are Installed
- **Node.js** (v18 or higher recommended; verified with v24+)
- **MySQL Server** (8.0+ or MariaDB via XAMPP) running as a Windows Service (check via `services.msc`)

---

### Step 2: Create the Database & Dedicated MySQL User
Open **MySQL Command Line Client** or **MySQL Workbench** and log in as `root`. Run the following SQL queries:

```sql
-- 1. Create the database if it doesn't already exist
CREATE DATABASE IF NOT EXISTS edupearl_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- 2. Create a dedicated application user (replace 'YourStrongPassword123!' with your own secret password)
CREATE USER IF NOT EXISTS 'edupearl_user'@'localhost' IDENTIFIED BY 'YourStrongPassword123!';

-- 3. Grant only required DDL and DML permissions on edupearl_db
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES 
ON edupearl_db.* 
TO 'edupearl_user'@'localhost';

-- 4. Apply the updated privileges
FLUSH PRIVILEGES;

-- 5. Verify the user grants
SHOW GRANTS FOR 'edupearl_user'@'localhost';
```

> **Viva Tip:** Never share or hardcode your password. Replace `'YourStrongPassword123!'` with your chosen password in the query above.

---

### Step 3: Configure Environment Variables in Windows

In your Windows terminal (PowerShell or Command Prompt) at the project root (`d:\Projects\Edupearl`):

1. Copy the sample environment file to create your active `.env` file:
   ```powershell
   copy .env.example .env
   ```
2. Open `.env` in your code editor and update the credentials:
   ```ini
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=edupearl_user
   DB_PASSWORD=YourStrongPassword123!
   DB_NAME=edupearl_db
   DB_CONNECTION_LIMIT=10
   ```
   *(Ensure `.env` matches the password you specified in Step 2)*

---

### Step 4: Install Dependencies

If not already installed, run:
```powershell
npm install
```

This installs:
- **`mysql2`**: High-performance MySQL driver with native Promise and connection pool support.
- **`dotenv`**: Loads environment variables from `.env` into `process.env`.

---

### Step 5: Test Database Connectivity

Run the connection test script:
```powershell
npm run test:db
```
*or directly via node:*
```powershell
node database/test-connection.js
```

---

## 4. Expected Output on Success

When properly configured, you should see output similar to:

```text
------------------------------------------------------------
Edu Pearl Immigration Services & Language Point
Testing MySQL Database Connectivity...
------------------------------------------------------------
Connection Parameters:
 • Host:     localhost
 • Port:     3306
 • User:     edupearl_user
 • Database: edupearl_db
 • Password: [CONFIGURED - HIDDEN FOR SECURITY]
------------------------------------------------------------
✅ Connection Successful!
 • Active DB:       edupearl_db
 • MySQL Version:   8.0.xx
 • Auth User:       edupearl_user@localhost
 • Test Query:      1 + 1 = 2
 • Tables Found:    0 table(s) present in edupearl_db
   (Database is currently clean and ready for schema migrations in Milestone 2)
------------------------------------------------------------
Milestone 1 Database Connectivity Verification PASSED.
------------------------------------------------------------
```

---

## 5. File & Architecture Explanation

| File Path | Description & Purpose |
| :--- | :--- |
| `package.json` | Project manifest declaring metadata, scripts (`test:db`), and Milestone 1 dependencies (`dotenv`, `mysql2`). |
| `.gitignore` | Prevents `.env` (secrets), `node_modules/` (heavy vendor code), and logs from ever being tracked in Git. |
| `.env.example` | Template file showing needed environment variable keys with placeholder values for collaborators. |
| `src/config/db.js` | Centralized database connection pool configured with `mysql2/promise` using environment variables. |
| `database/test-connection.js` | Secure verification script that validates pool creation, ping, and server metadata without leaking passwords. |
| `database/schema.sql` | Milestone 2 relational schema creating `admins`, `branches`, `services_courses`, and `enquiries` with foreign keys and indexes. |
| `database/seed.sql` | Milestone 2 safe seed script containing sample services, courses, and clearly labeled fictional test branches/enquiries. |
| `src/server.js` | HTTP server entry point loading `.env`, binding to port, and managing graceful shutdowns. |
| `src/app.js` | Express application setup with middleware, health routes, 404 handler, and centralized error handler. |
| `src/routes/health.routes.js` | Express route definitions for `/api/health` and `/api/health/db`. |
| `src/controllers/health.controller.js` | Health-check controller executing non-leaking liveness and database ping tests. |
| `scripts/create-admin.js` | Dedicated CLI tool for interactive creation of initial super_admin account with hidden password input and bcrypt hashing. |

---

## 6. Milestone 3: Express Backend Foundation & Admin CLI Guide

### Starting the Express Server
```powershell
# Production / Standard Start
npm start

# Development Mode with Native Auto-Reload (Node 18+)
npm run dev
```

### Health Check Endpoints
Once started, the following diagnostic endpoints are available:

1. **API Liveness Check:**
   - **URL:** `http://localhost:5000/api/health`
   - **Method:** `GET`
   - **Expected Response (200 OK):**
     ```json
     {
       "status": "ok",
       "service": "Edu Pearl Immigration Services & Language Point API",
       "timestamp": "2026-10-24T12:00:00.000Z"
     }
     ```

2. **Database Connectivity Check:**
   - **URL:** `http://localhost:5000/api/health/db`
   - **Method:** `GET`
   - **Expected Response (200 OK):**
     ```json
     {
       "status": "ok",
       "database": "connected",
       "timestamp": "2026-10-24T12:00:00.000Z"
     }
     ```
   - **Failure Response (503 Service Unavailable):**
     ```json
     {
       "status": "error",
       "database": "disconnected",
       "message": "Unable to connect to the database service."
     }
     ```

3. **Undefined Routes (404 Not Found):**
   - Any unmapped endpoint returns a clean JSON error:
     ```json
     {
       "error": "Not Found",
       "message": "Cannot GET /api/unknown"
     }
     ```

---

### Secure Administrator Creation CLI

To create the initial administrative account without exposing plaintext passwords:

```powershell
npm run create-admin
```

**Security Features of `scripts/create-admin.js`:**
1. **Hidden Keystroke Input:** Passwords and password confirmations are typed in raw terminal mode without terminal echo (no shoulder-surfing vulnerability).
2. **Input Validation:** Enforces minimum 8 characters with at least one letter and one digit.
3. **Collision Detection:** Queries `admins` table to prevent duplicate username or email collisions before hashing.
4. **Bcrypt Salting & Hashing:** Generates 12 salt rounds using `bcryptjs` before insertion.
5. **No Password Exposure:** Neither the entered password nor the hash is ever logged to the console.

---

## 7. Viva & Technical Q&A Preparation (LPU BCA)

**Q1: What is a Connection Pool and why is it preferred over a single connection?**  
*Answer:* A connection pool maintains an active cache of database connections. Establishing a TCP connection and performing SSL/TLS handshakes and MySQL authentication takes time and server resources. A pool reuses existing connections across multiple concurrent HTTP requests, significantly improving throughput and response time.

**Q2: What is the difference between `mysql` and `mysql2`?**  
*Answer:* `mysql2` is an optimized rewrite of the original `mysql` driver with improved speed, support for MySQL prepared statements, and first-class native Promise support (`mysql2/promise`) for clean `async/await` syntax.

**Q3: Why must `.env` never be pushed to GitHub?**  
*Answer:* `.env` contains confidential secrets like database passwords, API tokens, and secret keys. If committed to a public or private repository, attackers or automated scrapers can gain unauthorized access to the database or services.

**Q4: What is the purpose of `ON DELETE SET NULL` on `enquiries.preferred_branch_id`?**  
*Answer:* In relational databases, referential integrity rules dictate what happens to child records when a parent record is deleted. Using `ON DELETE SET NULL` ensures that if a branch location closes or is removed, historical student enquiry records are not lost or deleted. The `preferred_branch_id` foreign key is simply set to `NULL`, preserving lead history and contact information for audit purposes.

**Q5: Why do we use Database Indexes (e.g. `idx_enquiries_status`, `idx_services_category`)?**  
*Answer:* Without an index, MySQL must perform a "Full Table Scan" (reading every row from disk) to satisfy a `WHERE` or `ORDER BY` clause, with $O(N)$ time complexity. An index builds a B-Tree data structure ($O(\log N)$ search time) that allows the query engine to rapidly locate matching rows.

**Q6: Why are administrator passwords never stored in plaintext?**  
*Answer:* Plaintext storage creates a severe security vulnerability. If database records are leaked or accessed by an unauthorized party, all user accounts become immediately compromised. Using a salted one-way cryptographic hashing algorithm (like bcrypt or argon2) ensures that passwords cannot be decrypted or reverse-engineered.

**Q7: Why separate `server.js` and `app.js` in Express?**  
*Answer:* Separation of concerns. `app.js` focuses purely on configuring application middleware, route handlers, and error handlers, making it independently testable without binding to network sockets. `server.js` is responsible exclusively for environment initialization, port binding, and managing network lifecycle events (like graceful shutdown).

**Q8: How does centralized error-handling middleware work in Express?**  
*Answer:* Express identifies error middleware by its 4-parameter signature: `(err, req, res, next)`. When any route handler passes an error via `next(err)` or throws an asynchronous error, Express skips all remaining standard middleware and routes directly to this centralized handler, ensuring consistent error formatting and preventing internal stack trace leaks to clients.


