// medical_receipt_system/server/adminController.js
const db = require("./db");
const { formatTimestampForDisplayIST } = require('./utils/dateUtils');

// Helper to format data for display
const formatDataForView = (items, type) => {
    return items.map(item => ({
        ...item,
        display_date: formatTimestampForDisplayIST(item.created_at),
        display_customer_id: `CUST-${String(item.customer_id).padStart(10, '0')}`,
        display_doc_id: `${type === 'receipt' ? 'RCPT' : 'EST'}-${String(item.id).padStart(6, '0')}`,
        display_amount: `₹${parseFloat(item.amount).toFixed(2)}`
    }));
};

// --- View Receipts ---
exports.viewReceipts = (req, res) => {
    try {
        const receipts = db.prepare(`
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
        `).all();
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

// --- View Estimates ---
exports.viewEstimates = (req, res) => {
    try {
        const estimates = db.prepare(`
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
        `).all();
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
            SELECT
                u.id,
                u.username,
                u.role,
                b.name as branch_name,
                (
                    SELECT GROUP_CONCAT(pl.name, ', ')
                    FROM package_lists pl
                    JOIN user_package_list_access upla ON pl.id = upla.package_list_id
                    WHERE upla.user_id = u.id
                ) as assigned_lists
            FROM users u
            LEFT JOIN branches b ON u.branch_id = b.id
            ORDER BY u.username
        `).all();
        const branches = db.prepare("SELECT id, name FROM branches ORDER BY name").all();
        // This is needed for the "Add New User" form's dropdown menu
        const packageLists = db.prepare("SELECT id, name FROM package_lists ORDER BY name").all();

        res.render("admin/manage_users", { users, branches, packageLists });
    } catch (err) {
        console.error("Error loading manage users page:", err);
        res.status(500).send("Could not load page.");
    }
};

exports.createUser = (req, res) => {
    const { username, password, branch_id, role, package_list_id } = req.body;
    if (!username || !password || !branch_id || !role) {
        return res.status(400).send("Username, Password, Branch, and Role are required.");
    }
    try {
        const bcrypt = require("bcrypt");
        const password_hash = bcrypt.hashSync(password, 10);

        db.prepare(
            "INSERT INTO users (username, password_hash, branch_id, role, package_list_id) VALUES (?, ?, ?, ?, ?)"
        ).run(username, password_hash, branch_id, role, package_list_id || null);

        res.redirect("/admin/users");
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).send("A user with this username already exists.");
        }
        console.error("Error creating user:", err);
        res.status(500).send("Error creating user.");
    }
};

exports.deleteUser = (req, res) => {
    const { id } = req.params;
    const loggedInUserId = req.session.user.id;

    if (parseInt(id, 10) === loggedInUserId) {
        return res.status(403).send("Error: You cannot delete your own account.");
    }

    try {
        const info = db.prepare("DELETE FROM users WHERE id = ?").run(id);
        if (info.changes === 0) {
            return res.status(404).send("User not found or already deleted.");
        }
        console.log(`Admin (ID: ${loggedInUserId}) deleted user with ID: ${id}`);
        res.redirect("/admin/users");
    } catch (err) {
        console.error(`Error deleting user ${id}:`, err);
        if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
             return res.status(400).send("Cannot delete this user because they have existing records (receipts, estimates) in the system. Consider deactivating the user instead (future feature).");
        }
        res.status(500).send("Error deleting user.");
    }
};

exports.showEditUserPage = (req, res) => {
    const userId = req.params.id;
    try {
        const user = db.prepare("SELECT id, username, role, branch_id FROM users WHERE id = ?").get(userId);
        if (!user) return res.status(404).send("User not found.");

        const branches = db.prepare("SELECT id, name FROM branches").all();
        const packageLists = db.prepare("SELECT id, name FROM package_lists ORDER BY name").all();
        
        // Get the IDs of lists this user currently has access to
        const userAccess = db.prepare("SELECT package_list_id FROM user_package_list_access WHERE user_id = ?").all(userId);
        const userAccessIds = new Set(userAccess.map(item => item.package_list_id));

        res.render("admin/edit_user", { user, branches, packageLists, userAccessIds });
    } catch (err) {
        console.error("Error loading edit user page:", err);
        res.status(500).send("Could not load user data.");
    }
};

exports.updateUser = (req, res) => {
    const userId = req.params.id;
    const { username, password, branch_id, role, package_list_ids } = req.body;

    // Use a transaction to ensure atomicity
    const updateUserTransaction = db.transaction(() => {
        // 1. Update core user details
        if (password && password.trim() !== '') {
            const bcrypt = require("bcrypt");
            const password_hash = bcrypt.hashSync(password, 10);
            db.prepare("UPDATE users SET username = ?, role = ?, branch_id = ?, password_hash = ? WHERE id = ?")
              .run(username, role, branch_id, password_hash, userId);
        } else {
            db.prepare("UPDATE users SET username = ?, role = ?, branch_id = ? WHERE id = ?")
              .run(username, role, branch_id, userId);
        }

        // 2. Clear existing package list permissions for this user
        db.prepare("DELETE FROM user_package_list_access WHERE user_id = ?").run(userId);

        // 3. Insert new permissions
        if (package_list_ids) {
            const insertAccess = db.prepare("INSERT INTO user_package_list_access (user_id, package_list_id) VALUES (?, ?)");
            const ids = Array.isArray(package_list_ids) ? package_list_ids : [package_list_ids];
            ids.forEach(listId => {
                insertAccess.run(userId, listId);
            });
        }
    });

    try {
        updateUserTransaction();
        res.redirect("/admin/users");
    } catch (err) {
        console.error(`Error updating user ${userId}:`, err);
        res.status(500).send("Error updating user.");
    }
};
