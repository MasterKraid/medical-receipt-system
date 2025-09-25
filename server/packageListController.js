// server/packageListController.js
const db = require("./db");
const xlsx = require("xlsx");
const fs =require("fs");

exports.showManageListsPage = (req, res) => {
    try {
        const lists = db.prepare(`
            SELECT pl.id, pl.name, COUNT(p.id) as package_count
            FROM package_lists pl
            LEFT JOIN packages p ON pl.id = p.package_list_id
            GROUP BY pl.id, pl.name
            ORDER BY pl.name
        `).all();
        res.render("admin/manage_package_lists", { lists });
    } catch (err) {
        console.error("Error loading package lists page:", err);
        res.status(500).send("Could not load page.");
    }
};

exports.createList = (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === '') {
        return res.status(400).send("List name cannot be empty.");
    }
    try {
        db.prepare("INSERT INTO package_lists (name) VALUES (?)").run(name.trim());
        res.redirect("/admin/package-lists");
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).send("A package list with this name already exists.");
        }
        console.error("Error creating package list:", err);
        res.status(500).send("Error creating list.");
    }
};

exports.showListPageDetails = (req, res) => {
    const listId = req.params.id;
    try {
        const list = db.prepare("SELECT * FROM package_lists WHERE id = ?").get(listId);
        if (!list) return res.status(404).send("Package list not found.");

        const packages = db.prepare("SELECT * FROM packages WHERE package_list_id = ? ORDER BY name").all(listId);
        
        res.render("admin/edit_package_list", { list, packages });
    } catch (err) {
        console.error("Error fetching package list details:", err);
        res.status(500).send("Error loading page.");
    }
};

exports.addPackageToList = (req, res) => {
    const { package_list_id, name, mrp, b2b_price } = req.body;
    // Basic validation
    if (!name || isNaN(parseFloat(mrp)) || isNaN(parseFloat(b2b_price))) {
        return res.status(400).send("Invalid input.");
    }
    try {
        db.prepare("INSERT INTO packages (name, mrp, b2b_price, package_list_id) VALUES (?, ?, ?, ?)")
          .run(name, mrp, b2b_price, package_list_id);
        res.redirect(`/admin/package-lists/${package_list_id}`);
    } catch (err) {
        // Handle unique constraint error, etc.
        res.status(500).send("Error adding package.");
    }
};

exports.updatePackageInList = (req, res) => {
    const { package_id, package_list_id, name, mrp, b2b_price } = req.body;
    try {
        db.prepare("UPDATE packages SET name = ?, mrp = ?, b2b_price = ? WHERE id = ?")
          .run(name, mrp, b2b_price, package_id);
        res.redirect(`/admin/package-lists/${package_list_id}`);
    } catch (err) {
        res.status(500).send("Error updating package.");
    }
};

// --- REPLACE the old uploadPackages function with this one ---
exports.uploadPackages = (req, res) => {
    const { list_id } = req.body;
    if (!req.file) {
        return res.status(400).send("No Excel file was uploaded.");
    }
    if (!list_id) {
        fs.unlinkSync(req.file.path);
        return res.status(400).send("No package list was selected for import.");
    }

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (data.length === 0) throw new Error("Excel sheet is empty.");

        // Validate headers
        const requiredHeaders = ['name', 'mrp', 'b2b_price'];
        const actualHeaders = Object.keys(data[0]).map(h => h.trim().toLowerCase());
        if (!requiredHeaders.every(h => actualHeaders.includes(h))) {
            throw new Error(`Missing required columns. Headers must be exactly: ${requiredHeaders.join(', ')}.`);
        }
        
        // --- DATABASE-AGNOSTIC IMPORT LOGIC ---
        const findStmt = db.prepare("SELECT id FROM packages WHERE name = ? AND package_list_id = ?");
        const insertStmt = db.prepare("INSERT INTO packages (name, mrp, b2b_price, package_list_id) VALUES (?, ?, ?, ?)");
        const updateStmt = db.prepare("UPDATE packages SET mrp = ?, b2b_price = ? WHERE id = ?");

        const importTransaction = db.transaction((packages) => {
            let updated = 0, inserted = 0;
            for (const pkg of packages) {
                const name = String(pkg.name || pkg.Name || '').trim();
                const mrp = parseFloat(pkg.mrp || pkg.MRP);
                const b2b_price = parseFloat(pkg.b2b_price || pkg['b2b_price']);

                if (name && !isNaN(mrp) && !isNaN(b2b_price)) {
                    const existing = findStmt.get(name, list_id);
                    if (existing) {
                        updateStmt.run(mrp, b2b_price, existing.id);
                        updated++;
                    } else {
                        insertStmt.run(name, mrp, b2b_price, list_id);
                        inserted++;
                    }
                }
            }
            return { updated, inserted };
        });

        const result = importTransaction(data);
        console.log(`Import for list ID ${list_id} complete. Inserted: ${result.inserted}, Updated: ${result.updated}.`);
        res.redirect(`/admin/package-lists/${list_id}`); // Redirect to the details page

    } catch (err) {
        console.error("Excel import error:", err);
        res.status(500).send(`<h1>Import Failed</h1><p><strong>Error:</strong> ${err.message}</p><a href="/admin/labs">Go Back</a>`);
    } finally {
        fs.unlinkSync(req.file.path);
    }
};