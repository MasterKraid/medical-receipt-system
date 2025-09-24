// medical_receipt_system/server/packageController.js
const db = require("./db");

// Get all packages for dropdown/datalist based on user's assigned list
exports.getAllPackages = (req, res) => {
    // Get the user's assigned package list ID from their session
    let userPackageListId = req.session.user.packageListId;

    try {
        // If the user has no specific list assigned, fall back to the very first list in the DB (e.g., Default Retail)
        if (!userPackageListId) {
            console.warn(`User ${req.session.user.username} has no package list. Falling back to default.`);
            const firstList = db.prepare("SELECT id FROM package_lists ORDER BY id LIMIT 1").get();
            if (!firstList) {
                // This happens if there are no package lists in the database at all.
                return res.json([]);
            }
            userPackageListId = firstList.id;
        }

        // Fetch packages from the user's assigned list, including the new b2b_price
        const stmt = db.prepare(
            "SELECT id, name, mrp, b2b_price FROM packages WHERE package_list_id = ? ORDER BY name COLLATE NOCASE",
        );
        const packages = stmt.all(userPackageListId);
        res.json(packages); // Send data as JSON
    } catch (err) {
        console.error("Error fetching packages:", err);
        res.status(500).json({ error: "Failed to retrieve packages" });
    }
};

// --- Admin Management Functions ---

// Show the main package management page
exports.showManagePackagesPage = (req, res) => {
    try {
        const packages = db.prepare("SELECT id, name, mrp FROM packages ORDER BY name COLLATE NOCASE").all();
        res.render("admin/manage_packages", { packages });
    } catch (err) {
        console.error("Error fetching packages for admin:", err);
        res.status(500).send("Could not load package management page.");
    }
};

// Create a new package
exports.createPackage = (req, res) => {
    const { name, mrp } = req.body;
    if (!name || !mrp || isNaN(parseFloat(mrp))) {
        return res.status(400).send("Package Name and a valid MRP are required.");
    }
    try {
        db.prepare("INSERT INTO packages (name, mrp) VALUES (?, ?)").run(name, parseFloat(mrp));
        res.redirect("/admin/packages");
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).send("A package with this name already exists.");
        }
        console.error("Error creating package:", err);
        res.status(500).send("Error creating package.");
    }
};

// Update an existing package
exports.updatePackage = (req, res) => {
    const { id } = req.params;
    const { name, mrp } = req.body;
    if (!name || !mrp || isNaN(parseFloat(mrp)) || !id) {
        return res.status(400).send("Package Name, a valid MRP, and an ID are required.");
    }
    try {
        db.prepare("UPDATE packages SET name = ?, mrp = ? WHERE id = ?").run(name, parseFloat(mrp), id);
        res.redirect("/admin/packages");
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).send("Another package already has this name.");
        }
        console.error(`Error updating package ${id}:`, err);
        res.status(500).send("Error updating package.");
    }
};