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
    console.log("Initializing database schema (v4 - Timestamp Handling)...");

    // --- Drop Tables (Uncomment ONLY for complete reset during dev) ---
    // console.warn('Dropping tables...');
    // db.exec('DROP TABLE IF EXISTS receipt_items;');
    // db.exec('DROP TABLE IF EXISTS estimate_items;');
    // db.exec('DROP TABLE IF EXISTS receipts;');
    // db.exec('DROP TABLE IF EXISTS estimates;');
    // db.exec('DROP TABLE IF EXISTS packages;');
    // db.exec('DROP TABLE IF EXISTS users;');
    // db.exec('DROP TABLE IF EXISTS branches;');
    // console.warn('Tables potentially dropped.');

    // Branches - Assuming created_at is less critical here, keep default or make nullable if preferred
    db.exec(
        `CREATE TABLE IF NOT EXISTS branches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            address TEXT,
            phone TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`
    );

    // Users - Keep default for seeding simplicity, or manage explicitly if user creation routes are added
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

    // Packages - Keep default for seeding simplicity
    db.exec(
        `CREATE TABLE IF NOT EXISTS packages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            mrp REAL NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`
    );

    // Estimates - REMOVED default, added NOT NULL for created_at
    db.exec(
        `CREATE TABLE IF NOT EXISTS estimates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            customer_name TEXT,
            customer_age INTEGER,
            customer_dob TEXT,
            customer_gender TEXT,
            customer_mobile TEXT,
            referred_by TEXT,
            estimate_date TEXT NOT NULL, -- Date the estimate is FOR
            discount_percentage REAL DEFAULT 0,
            amount_after_discount REAL,
            notes TEXT,
            created_at DATETIME NOT NULL, -- Timestamp when record was created
            FOREIGN KEY (branch_id) REFERENCES branches (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        );`
    );

    // Estimate Items - No timestamp needed here usually
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

    // Receipts - REMOVED default, added NOT NULL for created_at
    db.exec(
        `CREATE TABLE IF NOT EXISTS receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            estimate_id INTEGER, -- Link to an original estimate, if any
            customer_name TEXT NOT NULL,
            customer_age INTEGER,
            customer_dob TEXT,
            customer_gender TEXT,
            customer_mobile TEXT,
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
            created_at DATETIME NOT NULL, -- Timestamp when record was created
            FOREIGN KEY (branch_id) REFERENCES branches (id),
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (estimate_id) REFERENCES estimates (id) ON DELETE SET NULL
        );`
    );

    // Receipt Items - No timestamp needed here usually
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

    console.log("All tables checked/created.");

    // --- Seed Data (Unaffected by timestamp changes on estimate/receipt tables) ---
    const branchCount = db.prepare("SELECT COUNT(*) as count FROM branches").get().count;
    let defaultBranchId = 1;
    if (branchCount === 0) {
        const info = db
            .prepare("INSERT INTO branches (name, address, phone) VALUES (?, ?, ?)")
            .run(
                "Main Branch",
                "123 Test Street, Kolkata\nNear Example Landmark",
                "999-888-7777 / 111-222-3333",
            );
        defaultBranchId = info.lastInsertRowid;
        console.log(`Created default branch ID: ${defaultBranchId}`);
    } else {
        // Get the ID of the first branch found if seeding isn't needed
        const firstBranch = db.prepare("SELECT id FROM branches ORDER BY id LIMIT 1").get();
        if (firstBranch) {
            defaultBranchId = firstBranch.id;
        } else {
             // This case should ideally not happen if branches exist, handle error
             console.error("FATAL: Branches table is not empty but failed to retrieve an ID.");
             process.exit(1); // Exit if no valid branch ID can be determined
        }
    }

    const adminUserCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE username = 'admin'").get().count;
    if (adminUserCount === 0) {
        const h = bcrypt.hashSync("password", 10); // WARNING: Default password!
        db.prepare(
            "INSERT INTO users (username, password_hash, branch_id, is_admin) VALUES (?, ?, ?, ?)",
        ).run("admin", h, defaultBranchId, 1);
        console.log(`Created admin user "admin". CHANGE PW!`);
    }

    const testUserCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE username = 'testuser'").get().count;
    if (testUserCount === 0) {
        const h = bcrypt.hashSync("test", 10); // WARNING: Default password!
        db.prepare(
            "INSERT INTO users (username, password_hash, branch_id, is_admin) VALUES (?, ?, ?, ?)",
        ).run("testuser", h, defaultBranchId, 0);
        console.log(`Created test user "testuser".`);
    }

    const packageCount = db.prepare("SELECT COUNT(*) as count FROM packages").get().count;
    if (packageCount === 0) {
        db.prepare("INSERT INTO packages (name, mrp) VALUES (?, ?)").run(
            "Basic Health Check",
            1200.0,
        );
        db.prepare("INSERT INTO packages (name, mrp) VALUES (?, ?)").run(
            "Blood Sugar Fasting",
            150.0,
        );
         db.prepare("INSERT INTO packages (name, mrp) VALUES (?, ?)").run(
             "Lipid Profile",
             800.0,
         );
        console.log("Seeded packages.");
    }

    console.log("Database initialization complete.");

} catch (err) {
    console.error("FATAL DB ERROR:", err.message);
    console.error(err.stack); // Log stack trace for debugging
    process.exit(1); // Exit if DB setup fails
}

module.exports = db;