// medical_receipt_system/server/adminController.js
const db = require("./db");
const { formatTimestampForDisplayIST } = require('./utils/dateUtils');

// Helper to format data for display
const formatDataForView = (items, type) => {
    return items.map(item => ({
        ...item,
        // Use the same robust date formatting from receipts
        display_date: formatTimestampForDisplayIST(item.created_at),
        // Format the customer ID for consistency
        display_customer_id: `CUST-${String(item.customer_id).padStart(10, '0')}`,
        // Format the document ID
        display_doc_id: `${type === 'receipt' ? 'RCPT' : 'EST'}-${String(item.id).padStart(6, '0')}`,
        // Format currency
        display_amount: `₹${parseFloat(item.amount).toFixed(2)}`
    }));
};

//view receipts
exports.viewReceipts = (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT
                r.id,
                r.created_at,
                r.amount_final as amount,
                c.id as customer_id,
                c.name as customer_name,
                u.username as created_by_user
            FROM receipts r
            JOIN customers c ON r.customer_id = c.id
            JOIN users u ON r.user_id = u.id
            ORDER BY r.id DESC
            LIMIT 200
        `);
        const receipts = stmt.all();
        res.render("admin/view_documents", {
            title: "Receipts",
            documents: formatDataForView(receipts, 'receipt'),
            docType: 'receipt'
        });
    } catch (err) {
        console.error("Error fetching receipts:", err);
        res.status(500).send("Error fetching receipts.");
    }
};

//view Essstimates
exports.viewEstimates = (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT
                e.id,
                e.created_at,
                e.amount_after_discount as amount,
                c.id as customer_id,
                c.name as customer_name,
                u.username as created_by_user
            FROM estimates e
            JOIN customers c ON e.customer_id = c.id
            JOIN users u ON e.user_id = u.id
            ORDER BY e.id DESC
            LIMIT 200
        `);
        const estimates = stmt.all();
        res.render("admin/view_documents", {
            title: "Estimates",
            documents: formatDataForView(estimates, 'estimate'),
            docType: 'estimate'
        });
    } catch (err) {
        console.error("Error fetching estimates:", err);
        res.status(500).send("Error fetching estimates.");
    }
};

// --- View Customers ---
exports.viewCustomers = (req, res) => {
    try {
        const customers = db.prepare(`
            SELECT id, name, mobile, dob, age, gender, created_at
            FROM customers
            ORDER BY id DESC
            LIMIT 200
        `).all();
        
        const formattedCustomers = customers.map(cust => ({
            ...cust,
            display_id: `CUST-${String(cust.id).padStart(10, '0')}`,
            display_created_at: formatTimestampForDisplayIST(cust.created_at)
        }));

        res.render("admin/view_customers", { customers: formattedCustomers });
    } catch (err) {
        console.error("Error fetching customers:", err);
        res.status(500).send("Error fetching customers.");
    }
};

// --- Manage Branches ---
exports.showManageBranchesPage = (req, res) => {
    try {
        const branches = db.prepare("SELECT * FROM branches ORDER BY name").all();
        res.render("admin/manage_branches", { branches });
    } catch (err) {
        console.error("Error loading manage branches page:", err);
        res.status(500).send("Could not load page.");
    }
};

exports.createBranch = (req, res) => {
    const { name, address, phone } = req.body;
    if (!name || !address || !phone) {
        return res.status(400).send("All branch fields are required.");
    }
    try {
        db.prepare("INSERT INTO branches (name, address, phone) VALUES (?, ?, ?)").run(name, address, phone);
        res.redirect("/admin/branches");
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).send("A branch with this name already exists.");
        }
        console.error("Error creating branch:", err);
        res.status(500).send("Error creating branch.");
    }
};

exports.updateBranch = (req, res) => {
    const { id } = req.params;
    const { name, address, phone } = req.body;
    if (!name || !address || !phone) {
        return res.status(400).send("All branch fields are required.");
    }
    try {
        db.prepare("UPDATE branches SET name = ?, address = ?, phone = ? WHERE id = ?").run(name, address, phone, id);
        res.redirect("/admin/branches");
    } catch (err) {
        console.error(`Error updating branch ${id}:`, err);
        res.status(500).send("Error updating branch.");
    }
};

// --- Manage Users ---
exports.showManageUsersPage = (req, res) => {
    try {
        const users = db.prepare(`
            SELECT u.id, u.username, u.is_admin, b.name as branch_name
            FROM users u
            JOIN branches b ON u.branch_id = b.id
            ORDER BY u.username
        `).all();
        const branches = db.prepare("SELECT id, name FROM branches ORDER BY name").all();
        res.render("admin/manage_users", { users, branches });
    } catch (err) {
        console.error("Error loading manage users page:", err);
        res.status(500).send("Could not load page.");
    }
};

exports.createUser = (req, res) => {
    const { username, password, branch_id, is_admin } = req.body;
    if (!username || !password || !branch_id) {
        return res.status(400).send("Username, Password, and Branch are required.");
    }
    try {
        const bcrypt = require("bcrypt");
        const password_hash = bcrypt.hashSync(password, 10);
        const isAdminValue = is_admin ? 1 : 0; // Convert 'on' or undefined to 1 or 0
        
        db.prepare(
            "INSERT INTO users (username, password_hash, branch_id, is_admin) VALUES (?, ?, ?, ?)"
        ).run(username, password_hash, branch_id, isAdminValue);
        
        res.redirect("/admin/users");
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).send("A user with this username already exists.");
        }
        console.error("Error creating user:", err);
        res.status(500).send("Error creating user.");
    }
};