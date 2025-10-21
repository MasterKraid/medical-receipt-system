import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';

// Get the path to the 'data' directory, which is one level above the compiled '/dist' directory.
const dataDir = path.resolve(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'data.db');

// Ensure the directory for the database exists (it will, but this is good practice)
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Database connected at', dbPath);

const schema = `
    -- Your existing schema creation statements will go here...
    CREATE TABLE IF NOT EXISTS branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        address TEXT,
        phone TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        alias TEXT,
        password_hash TEXT NOT NULL,
        branchId INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('ADMIN', 'GENERAL_EMPLOYEE', 'CLIENT')),
        wallet_balance REAL NOT NULL DEFAULT 0,
        allow_negative_balance BOOLEAN NOT NULL DEFAULT 0,
        negative_balance_allowed_until TEXT,
        FOREIGN KEY (branchId) REFERENCES branches(id)
    );
    
    -- ... and so on for all other tables
    CREATE TABLE IF NOT EXISTS package_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mrp REAL NOT NULL,
        b2b_price REAL NOT NULL,
        package_list_id INTEGER NOT NULL,
        FOREIGN KEY (package_list_id) REFERENCES package_lists(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS labs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        logo_path TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prefix TEXT,
        name TEXT NOT NULL,
        mobile TEXT,
        dob TEXT,
        age INTEGER,
        gender TEXT CHECK(gender IN ('Male', 'Female')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by_user_id INTEGER NOT NULL,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        branch_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        total_mrp REAL NOT NULL,
        amount_final REAL NOT NULL,
        amount_received REAL NOT NULL,
        amount_due REAL NOT NULL,
        payment_method TEXT NOT NULL,
        referred_by TEXT,
        notes TEXT,
        num_tests INTEGER,
        logo_path TEXT,
        created_by_user_id INTEGER NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (branch_id) REFERENCES branches(id),
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS receipt_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id INTEGER NOT NULL,
        package_name TEXT NOT NULL,
        mrp REAL NOT NULL,
        discount_percentage REAL NOT NULL,
        FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS estimates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        branch_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        amount_after_discount REAL NOT NULL,
        referred_by TEXT,
        notes TEXT,
        created_by_user_id INTEGER NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (branch_id) REFERENCES branches(id),
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS estimate_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        estimate_id INTEGER NOT NULL,
        package_name TEXT NOT NULL,
        mrp REAL NOT NULL,
        discount_percentage REAL NOT NULL,
        FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('RECEIPT_DEDUCTION', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'SETTLEMENT')),
        amount_deducted REAL NOT NULL,
        notes TEXT,
        receipt_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS lab_package_lists (
        lab_id INTEGER NOT NULL,
        package_list_id INTEGER NOT NULL,
        PRIMARY KEY (lab_id, package_list_id),
        FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE,
        FOREIGN KEY (package_list_id) REFERENCES package_lists(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_package_list_access (
        user_id INTEGER NOT NULL,
        package_list_id INTEGER NOT NULL,
        PRIMARY KEY (user_id, package_list_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (package_list_id) REFERENCES package_lists(id) ON DELETE CASCADE
    );
`;

export function initDb() {
    db.exec(schema);

    // Seeding data (only if tables are empty)
    const transaction = db.transaction(() => {
        // Check if admin user exists
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
        if (userCount.count > 0) {
            console.log('Database already seeded.');
            return;
        }

        console.log('Seeding database...');
        
        // Branches
        const mainBranchId = db.prepare('INSERT INTO branches (name, address, phone) VALUES (?, ?, ?)').run('Main Branch', '123 Test Street, Kolkata', '999-888-7777').lastInsertRowid;

        // Users
        const saltRounds = 10;
        const adminPass = bcrypt.hashSync('password', saltRounds);
        const testPass = bcrypt.hashSync('test', saltRounds);
        const clientPass = bcrypt.hashSync('client123', saltRounds);

        const adminId = db.prepare('INSERT INTO users (username, password_hash, branchId, role) VALUES (?, ?, ?, ?)').run('admin', adminPass, mainBranchId, 'ADMIN').lastInsertRowid;
        const testUserId = db.prepare('INSERT INTO users (username, password_hash, branchId, role) VALUES (?, ?, ?, ?)').run('testuser', testPass, mainBranchId, 'GENERAL_EMPLOYEE').lastInsertRowid;
        const clientId = db.prepare('INSERT INTO users (username, alias, password_hash, branchId, role, wallet_balance) VALUES (?, ?, ?, ?, ?, ?)').run('client@b2b.com', 'B2B Corporate Client', clientPass, mainBranchId, 'CLIENT', 5000).lastInsertRowid;
        
        // Package Lists
        const retailListId = db.prepare('INSERT INTO package_lists (name) VALUES (?)').run('Retail Rates (Walk-in)').lastInsertRowid;
        const corpListId = db.prepare('INSERT INTO package_lists (name) VALUES (?)').run('Corporate Rates (B2B)').lastInsertRowid;

        // Packages
        const insertPackage = db.prepare('INSERT INTO packages (name, mrp, b2b_price, package_list_id) VALUES (?, ?, ?, ?)');
        insertPackage.run('Basic Health Check', 1200.0, 900.0, retailListId);
        insertPackage.run('Advanced Health Check', 2500.0, 1800.0, retailListId);
        insertPackage.run('Corporate Wellness Package', 1000.0, 750.0, corpListId);
        insertPackage.run('Pre-employment Screening', 1500.0, 1100.0, corpListId);

        // Labs
        const apolloId = db.prepare('INSERT INTO labs (name, logo_path) VALUES (?, ?)').run('Apollo Diagnostic', '/lab_logos/lab_1.png').lastInsertRowid;
        const lalPathId = db.prepare('INSERT INTO labs (name) VALUES (?)').run('Dr. Lal PathLabs').lastInsertRowid;

        // Junction tables
        const insertLabList = db.prepare('INSERT INTO lab_package_lists (lab_id, package_list_id) VALUES (?, ?)');
        insertLabList.run(apolloId, retailListId);
        insertLabList.run(lalPathId, retailListId);
        insertLabList.run(lalPathId, corpListId);

        const insertUserList = db.prepare('INSERT INTO user_package_list_access (user_id, package_list_id) VALUES (?, ?)');
        insertUserList.run(testUserId, retailListId);
        insertUserList.run(clientId, corpListId);

        console.log('Database seeded successfully.');
    });

    try {
        transaction();
    } catch (err) {
        console.error('Seeding failed:', err);
    }
}