// medical_receipt_system/server/packageController.js
const db = require("./db");

// Get all packages for dropdown/datalist based on user's assigned list
exports.getAllPackages = (req, res) => {
    const { labId } = req.query; // Get labId from query parameter
    if (!labId) {
        return res.status(400).json({ error: "Lab ID is required." });
    }

    try {
        const packageList = db.prepare("SELECT package_list_id FROM labs WHERE id = ?").get(labId);
        if (!packageList || !packageList.package_list_id) {
            console.warn(`No package list assigned to lab ${labId}.`);
            return res.json([]); // Return empty if no list is assigned
        }

        const packages = db.prepare(
            "SELECT id, name, mrp, b2b_price FROM packages WHERE package_list_id = ? ORDER BY name COLLATE NOCASE"
        ).all(packageList.package_list_id);
        
        res.json(packages);
    } catch (err) {
        console.error("Error fetching packages for lab:", err);
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