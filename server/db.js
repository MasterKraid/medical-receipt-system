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
    console.log("Initializing database schema...");

    // ===================================================================
    // --- NEW SCHEMA DEFINITIONS ---
    // ===================================================================

    // --- Core Tables ---
    db.exec(`
        CREATE TABLE IF NOT EXISTS branches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            address TEXT,
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS package_lists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS labs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            logo_path TEXT
        );
    `);

    // --- Users Table (MODIFIED) ---
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            branch_id INTEGER NOT NULL,
            role TEXT NOT NULL DEFAULT 'GENERAL_EMPLOYEE',
            wallet_balance REAL DEFAULT 0,
            allow_negative_balance BOOLEAN DEFAULT 0,
            negative_balance_allowed_until TEXT,
            package_list_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT,
            FOREIGN KEY (package_list_id) REFERENCES package_lists (id) ON DELETE SET NULL
        );
    `);

    try { db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'GENERAL_EMPLOYEE'"); } catch (e) {}
    try { db.exec("ALTER TABLE users ADD COLUMN wallet_balance REAL DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE users ADD COLUMN allow_negative_balance BOOLEAN DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE users ADD COLUMN negative_balance_allowed_until TEXT"); } catch (e) {}
    try { db.exec("ALTER TABLE users ADD COLUMN package_list_id INTEGER REFERENCES package_lists(id) ON DELETE SET NULL"); } catch (e) {}
    try { db.exec("UPDATE users SET role = 'ADMIN' WHERE is_admin = 1 AND role != 'ADMIN'"); } catch (e) {}

    // --- Packages Table (MODIFIED) ---
    db.exec(`
        CREATE TABLE IF NOT EXISTS packages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mrp REAL NOT NULL DEFAULT 0,
            b2b_price REAL NOT NULL DEFAULT 0,
            package_list_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (package_list_id) REFERENCES package_lists (id) ON DELETE CASCADE,
            UNIQUE(name, package_list_id)
        );
    `);
    try { db.exec("ALTER TABLE packages ADD COLUMN b2b_price REAL NOT NULL DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE packages ADD COLUMN package_list_id INTEGER REFERENCES package_lists(id) ON DELETE CASCADE"); } catch (e) {}

    // --- Customers Table (MODIFIED) ---
    db.exec(`
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mobile TEXT UNIQUE,
            dob TEXT,
            age INTEGER,
            gender TEXT,
            created_by_user_id INTEGER,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
        );
    `);
    try { db.exec("ALTER TABLE customers ADD COLUMN created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL"); } catch (e) {}
    db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers (mobile);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);`);

    // --- Estimates Table (MODIFIED) ---
    db.exec(`
        CREATE TABLE IF NOT EXISTS estimates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            customer_id INTEGER NOT NULL,
            lab_id INTEGER,
            estimate_date TEXT NOT NULL,
            referred_by TEXT,
            discount_percentage REAL DEFAULT 0,
            amount_after_discount REAL,
            notes TEXT,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (branch_id) REFERENCES branches (id),
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
            FOREIGN KEY (lab_id) REFERENCES labs (id) ON DELETE SET NULL
        );
    `);
    try { db.exec("ALTER TABLE estimates ADD COLUMN lab_id INTEGER REFERENCES labs(id) ON DELETE SET NULL"); } catch (e) {}

    db.exec(`
        CREATE TABLE IF NOT EXISTS estimate_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            estimate_id INTEGER NOT NULL,
            package_name TEXT NOT NULL,
            mrp REAL NOT NULL DEFAULT 0,
            b2b_price REAL NOT NULL DEFAULT 0,
            discount_percentage REAL DEFAULT 0,
            FOREIGN KEY (estimate_id) REFERENCES estimates (id) ON DELETE CASCADE
        );
    `);
    try { db.exec("ALTER TABLE estimate_items ADD COLUMN b2b_price REAL NOT NULL DEFAULT 0"); } catch (e) {}

    // --- Receipts Table (MODIFIED) ---
    db.exec(`
        CREATE TABLE IF NOT EXISTS receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            customer_id INTEGER NOT NULL,
            lab_id INTEGER,
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
            FOREIGN KEY (estimate_id) REFERENCES estimates (id) ON DELETE SET NULL,
            FOREIGN KEY (lab_id) REFERENCES labs (id) ON DELETE SET NULL
        );
    `);
    try { db.exec("ALTER TABLE receipts ADD COLUMN lab_id INTEGER REFERENCES labs(id) ON DELETE SET NULL"); } catch (e) {}

    db.exec(`
        CREATE TABLE IF NOT EXISTS receipt_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_id INTEGER NOT NULL,
            package_name TEXT NOT NULL,
            mrp REAL NOT NULL DEFAULT 0,
            b2b_price REAL NOT NULL DEFAULT 0,
            discount_percentage REAL DEFAULT 0,
            FOREIGN KEY (receipt_id) REFERENCES receipts (id) ON DELETE CASCADE
        );
    `);
    try { db.exec("ALTER TABLE receipt_items ADD COLUMN b2b_price REAL NOT NULL DEFAULT 0"); } catch (e) {}

    console.log("All tables checked/created.");

    // ===================================================================
    // --- Seed Data ---
    // ===================================================================

    // Branches
    const branchCount = db.prepare("SELECT COUNT(*) as count FROM branches").get().count;
    let defaultBranchId = 1;
    if (branchCount === 0) {
        const info = db
            .prepare("INSERT INTO branches (name, address, phone) VALUES (?, ?, ?)")
            .run("Main Branch", "123 Test Street, Kolkata\nNear Example Landmark", "999-888-7777 / 111-222-3333");
        defaultBranchId = info.lastInsertRowid;
        console.log(`Created default branch ID: ${defaultBranchId}`);
    } else {
        const firstBranch = db.prepare("SELECT id FROM branches ORDER BY id LIMIT 1").get();
        if (firstBranch) {
            defaultBranchId = firstBranch.id;
        } else {
            console.error("FATAL: Branches table is not empty but failed to retrieve an ID.");
            process.exit(1);
        }
    }

    // Package Lists
    const packageListCount = db.prepare("SELECT COUNT(*) as count FROM package_lists").get().count;
    let defaultPackageListId = 1;
    if (packageListCount === 0) {
        const info = db.prepare("INSERT INTO package_lists (name) VALUES (?)").run("Default Retail Rates");
        defaultPackageListId = info.lastInsertRowid;
        db.prepare("INSERT INTO package_lists (name) VALUES (?)").run("Corporate Client Rates");
        console.log("Seeded package lists.");
    } else {
        const firstList = db.prepare("SELECT id FROM package_lists ORDER BY id LIMIT 1").get();
        if (firstList) defaultPackageListId = firstList.id;
    }

    // Users
    const adminUserCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE username = 'admin'").get().count;
    if (adminUserCount === 0) {
        const h = bcrypt.hashSync("password", 10);
        db.prepare(
            "INSERT INTO users (username, password_hash, branch_id, role, package_list_id) VALUES (?, ?, ?, ?, ?)"
        ).run("admin", h, defaultBranchId, "ADMIN", defaultPackageListId);
        console.log(`Created admin user "admin". CHANGE PW!`);
    }

    const testUserCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE username = 'testuser'").get().count;
    if (testUserCount === 0) {
        const h = bcrypt.hashSync("test", 10);
        db.prepare(
            "INSERT INTO users (username, password_hash, branch_id, role, package_list_id) VALUES (?, ?, ?, ?, ?)"
        ).run("testuser", h, defaultBranchId, "GENERAL_EMPLOYEE", defaultPackageListId);
        console.log(`Created test user "testuser".`);
    }

    // Packages
    const packageCount = db.prepare("SELECT COUNT(*) as count FROM packages").get().count;
    if (packageCount === 0) {
        db.prepare(
            "INSERT INTO packages (name, mrp, b2b_price, package_list_id) VALUES (?, ?, ?, ?)"
        ).run("Basic Health Check", 1200.0, 900.0, defaultPackageListId);

        db.prepare(
            "INSERT INTO packages (name, mrp, b2b_price, package_list_id) VALUES (?, ?, ?, ?)"
        ).run("Blood Sugar Fasting", 150.0, 100.0, defaultPackageListId);

        db.prepare(
            "INSERT INTO packages (name, mrp, b2b_price, package_list_id) VALUES (?, ?, ?, ?)"
        ).run("Lipid Profile", 800.0, 650.0, defaultPackageListId);

        console.log("Seeded packages.");
    }

    // Labs
    const labCount = db.prepare("SELECT COUNT(*) as count FROM labs").get().count;
    if (labCount === 0) {
        console.log("Seeding labs...");
        const insertLab = db.prepare("INSERT INTO labs (name) VALUES (?)");
        insertLab.run("Apollo Diagnostic");
        insertLab.run("Labcorp Diagnostic");
        insertLab.run("RB Diagnostic");
        console.log("Seeded labs.");
    }

    console.log("Database initialization complete.");
} catch (err) {
    console.error("FATAL DB ERROR:", err.message);
    console.error(err.stack);
    process.exit(1);
}

module.exports = db;
