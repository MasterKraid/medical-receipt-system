// medical_receipt_system/server/db.js
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "..", "data", "database.sqlite");
let db;

try {
    db = new Database(dbPath);
    console.log("Database connected successfully at:", dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    console.log("Initializing database schema (v6 - Added Customer Age Field)...");

    // --- Drop Tables (Optional: Clean slate if needed during intense dev) ---
    // console.warn('Dropping ALL tables for reset...');
    // db.exec('DROP TABLE IF EXISTS receipt_items;');
    // db.exec('DROP TABLE IF EXISTS estimate_items;');
    // db.exec('DROP TABLE IF EXISTS receipts;');
    // db.exec('DROP TABLE IF EXISTS estimates;');
    // db.exec('DROP TABLE IF EXISTS customers;'); // Drop new table too if resetting
    // db.exec('DROP TABLE IF EXISTS packages;');
    // db.exec('DROP TABLE IF EXISTS users;');
    // db.exec('DROP TABLE IF EXISTS branches;');
    // console.warn('Tables potentially dropped.');

    // Branches (Unchanged)
    db.exec(
        `CREATE TABLE IF NOT EXISTS branches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            address TEXT,
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`
    );

    // Users (Unchanged)
    db.exec(
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            branch_id INTEGER NOT NULL,
            is_admin BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT
        );`
    );

    // Packages (Unchanged)
    db.exec(
        `CREATE TABLE IF NOT EXISTS packages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            mrp REAL NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`
    );

    // --- Customers Table - ADDED age column ---
    db.exec(
      `CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mobile TEXT UNIQUE,    -- Allow null mobile but if present must be unique
            dob TEXT,             -- Store as YYYY-MM-DD
            age INTEGER,          -- Store explicitly provided age (if DOB not given)
            gender TEXT,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
      );`
    );
    db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers (mobile);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);`);


    // Estimates - Modified FK relationship (Unchanged from v5)
    db.exec(
        `CREATE TABLE IF NOT EXISTS estimates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            customer_id INTEGER NOT NULL, -- Link to customers table
            estimate_date TEXT NOT NULL,
            referred_by TEXT,
            discount_percentage REAL DEFAULT 0,
            amount_after_discount REAL,
            notes TEXT,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (branch_id) REFERENCES branches (id),
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT
        );`
    );

    // Estimate Items (Unchanged)
    db.exec(
        `CREATE TABLE IF NOT EXISTS estimate_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            estimate_id INTEGER NOT NULL,
            package_name TEXT NOT NULL,
            mrp REAL NOT NULL DEFAULT 0,
            discount_percentage REAL DEFAULT 0,
            FOREIGN KEY (estimate_id) REFERENCES estimates (id) ON DELETE CASCADE
        );`
    );

    // Receipts - Modified FK relationship (Unchanged from v5)
    db.exec(
        `CREATE TABLE IF NOT EXISTS receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            customer_id INTEGER NOT NULL, -- Link to customers table
            estimate_id INTEGER,
            referred_by TEXT,
            total_mrp REAL DEFAULT 0,
            discount_percentage REAL DEFAULT 0,
            amount_final REAL NOT NULL,
            amount_received REAL NOT NULL DEFAULT 0,
            amount_due REAL DEFAULT 0,
            payment_method TEXT,
            num_tests INTEGER,
            conducted_at TEXT,
            notes TEXT,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (branch_id) REFERENCES branches (id),
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
            FOREIGN KEY (estimate_id) REFERENCES estimates (id) ON DELETE SET NULL
        );`
    );

    // Receipt Items (Unchanged)
    db.exec(
        `CREATE TABLE IF NOT EXISTS receipt_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_id INTEGER NOT NULL,
            package_name TEXT NOT NULL,
            mrp REAL NOT NULL DEFAULT 0,
            discount_percentage REAL DEFAULT 0,
            FOREIGN KEY (receipt_id) REFERENCES receipts (id) ON DELETE CASCADE
        );`
    );
    // Test Locations Table (NEW)
    db.exec(
        `CREATE TABLE IF NOT EXISTS test_locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );`
    );
    console.log("All tables checked/created.");

    // --- Seed Data (Unchanged from v5) ---
    // Branches
    const branchCount = db.prepare("SELECT COUNT(*) as count FROM branches").get().count;
    let defaultBranchId = 1;
    if (branchCount === 0) {
        const info = db.prepare("INSERT INTO branches (name, address, phone) VALUES (?, ?, ?)").run("Main Branch", "123 Test Street, Kolkata\nNear Example Landmark", "999-888-7777 / 111-222-3333");
        defaultBranchId = info.lastInsertRowid; console.log(`Created default branch ID: ${defaultBranchId}`);
    } else { const firstBranch = db.prepare("SELECT id FROM branches ORDER BY id LIMIT 1").get(); if (firstBranch) { defaultBranchId = firstBranch.id; } else { console.error("FATAL: Branches table is not empty but failed to retrieve an ID."); process.exit(1); } }
    // Users
    const adminUserCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE username = 'admin'").get().count; if (adminUserCount === 0) { const h = bcrypt.hashSync("password", 10); db.prepare("INSERT INTO users (username, password_hash, branch_id, is_admin) VALUES (?, ?, ?, ?)").run("admin", h, defaultBranchId, 1); console.log(`Created admin user "admin". CHANGE PW!`); }
    const testUserCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE username = 'testuser'").get().count; if (testUserCount === 0) { const h = bcrypt.hashSync("test", 10); db.prepare("INSERT INTO users (username, password_hash, branch_id, is_admin) VALUES (?, ?, ?, ?)").run("testuser", h, defaultBranchId, 0); console.log(`Created test user "testuser".`); }
    // Packages
    const packageCount = db.prepare("SELECT COUNT(*) as count FROM packages").get().count; if (packageCount === 0) { db.prepare("INSERT INTO packages (name, mrp) VALUES (?, ?)").run("Basic Health Check", 1200.0); db.prepare("INSERT INTO packages (name, mrp) VALUES (?, ?)").run("Blood Sugar Fasting", 150.0); db.prepare("INSERT INTO packages (name, mrp) VALUES (?, ?)").run("Lipid Profile", 800.0); console.log("Seeded packages."); }
    // Test Locations (NEW)
    const locationCount = db.prepare("SELECT COUNT(*) as count FROM test_locations").get().count;
    if (locationCount === 0) {
        console.log("Seeding test locations...");
        const insertLocation = db.prepare("INSERT INTO test_locations (name) VALUES (?)");
        insertLocation.run("Apollo Diagnostic");
        insertLocation.run("Labcorp Diagnostic (LDPL)");
        insertLocation.run("RB Diagnostic");
        insertLocation.run("General Diagnostic (GD)");
        insertLocation.run("Serum Analysis Centre");
        insertLocation.run("Thesim Diagnostic");
        console.log("Seeded test locations.");
    }

    console.log("Database initialization complete.");

} catch (err) {
    console.error("FATAL DB ERROR:", err.message);
    console.error(err.stack);
    process.exit(1);
}

module.exports = db;