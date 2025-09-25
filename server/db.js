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
    // --- SCHEMA DEFINITIONS ---
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

    // --- Join table for Labs <-> Package Lists (Many-to-Many) ---
    db.exec(`
        CREATE TABLE IF NOT EXISTS lab_package_lists (
            lab_id INTEGER NOT NULL,
            package_list_id INTEGER NOT NULL,
            PRIMARY KEY (lab_id, package_list_id),
            FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE,
            FOREIGN KEY (package_list_id) REFERENCES package_lists(id) ON DELETE CASCADE
        );
    `);

    // --- Join table for Users <-> Package Lists (Many-to-Many Access Control) ---
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_package_list_access (
            user_id INTEGER NOT NULL,
            package_list_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, package_list_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (package_list_id) REFERENCES package_lists(id) ON DELETE CASCADE
        );
    `);

    // --- Users Table ---
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE RESTRICT
        );
    `);

    // --- Packages Table ---
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

    // --- Customers Table ---
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
    db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers (mobile);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);`);

    // --- Estimates Table ---
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

    // --- Receipts Table ---
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

    console.log("All tables checked/created.");

    // ===================================================================
    // --- Seed Data ---
    // ===================================================================

    // Use a transaction for seeding to ensure it's all or nothing
    db.transaction(() => {
        try {
            // Branches
            const branchCount = db.prepare("SELECT COUNT(*) as count FROM branches").get().count;
            let defaultBranchId = 1;
            if (branchCount === 0) {
                const info = db.prepare("INSERT INTO branches (name, address, phone) VALUES (?, ?, ?)").    run("Main Branch", "123 Test Street, Kolkata", "999-888-7777");
                defaultBranchId = info.lastInsertRowid;
                console.log(`Seeded default branch.`);
            } else {
                defaultBranchId = db.prepare("SELECT id FROM branches ORDER BY id LIMIT 1").get().id;
            }
        
            // Users
            let adminId = 1, testUserId = 2;
            if (db.prepare("SELECT COUNT(*) as count FROM users").get().count === 0) {
                const adminHash = bcrypt.hashSync("password", 10);
                adminId = db.prepare("INSERT INTO users (username, password_hash, branch_id, role)  VALUES (?, ?, ?, ?)").run("admin", adminHash, defaultBranchId, "ADMIN").lastInsertRowid;
                
                const testUserHash = bcrypt.hashSync("test", 10);
                testUserId = db.prepare("INSERT INTO users (username, password_hash, branch_id, role)   VALUES (?, ?, ?, ?)").run("testuser", testUserHash, defaultBranchId,  "GENERAL_EMPLOYEE").lastInsertRowid;
                console.log(`Seeded default users.`);
            }
        
            // Package Lists, Packages, and Labs
            if (db.prepare("SELECT COUNT(*) as count FROM package_lists").get().count === 0) {
                // Create Lists
                const retailListId = db.prepare("INSERT INTO package_lists (name) VALUES (?)").run  ("Retail Rates (Walk-in)").lastInsertRowid;
                const corpListId = db.prepare("INSERT INTO package_lists (name) VALUES (?)").run    ("Corporate Rates (B2B)").lastInsertRowid;
            
                // Create Packages for those Lists
                db.prepare("INSERT INTO packages (name, mrp, b2b_price, package_list_id) VALUES     (?, ?, ?, ?)").run("Basic Health Check", 1200.0, 900.0, retailListId);
                db.prepare("INSERT INTO packages (name, mrp, b2b_price, package_list_id) VALUES     (?, ?, ?, ?)").run("Advanced Health Check", 2500.0, 1800.0, retailListId);
                db.prepare("INSERT INTO packages (name, mrp, b2b_price, package_list_id) VALUES     (?, ?, ?, ?)").run("Corporate Wellness Package", 1000.0, 750.0, corpListId);
                db.prepare("INSERT INTO packages (name, mrp, b2b_price, package_list_id) VALUES     (?, ?, ?, ?)").run("Pre-employment Screening", 1500.0, 1100.0, corpListId);
                
                // Create Labs
                const apolloId = db.prepare("INSERT INTO labs (name) VALUES (?)").run("Apollo   Diagnostic").lastInsertRowid;
                const lalPathId = db.prepare("INSERT INTO labs (name) VALUES (?)").run("Dr. Lal     PathLabs").lastInsertRowid;
            
                // Link Labs <-> Package Lists
                db.prepare("INSERT INTO lab_package_lists (lab_id, package_list_id) VALUES (?, ?)").run (apolloId, retailListId);
                db.prepare("INSERT INTO lab_package_lists (lab_id, package_list_id) VALUES (?, ?)").run (lalPathId, retailListId);
                db.prepare("INSERT INTO lab_package_lists (lab_id, package_list_id) VALUES (?, ?)").run (lalPathId, corpListId);
            
                // Link Users <-> Package Lists
                db.prepare("INSERT INTO user_package_list_access (user_id, package_list_id) VALUES  (?, ?)").run(testUserId, retailListId);
                db.prepare("INSERT INTO user_package_list_access (user_id, package_list_id) VALUES  (?, ?)").run(testUserId, corpListId);
                
                console.log(`Seeded lists, packages, labs, and permissions.`);
            }
        } catch (e) {
            console.error("❌ Seed transaction failed:", e);
            throw e; // rethrow to make sure the transaction rolls back
        }
    })(); // Immediately invoke the transaction

    console.log("Database initialization complete.");

} catch (err) {
    console.error("FATAL DB ERROR:", err.message);
    console.error(err.stack);
    process.exit(1);
}

module.exports = db;