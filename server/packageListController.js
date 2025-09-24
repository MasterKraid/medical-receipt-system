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

exports.uploadPackages = (req, res) => {
    const { list_id } = req.body;
    if (!req.file) {
        return res.status(400).send("No Excel file was uploaded.");
    }
    if (!list_id) {
        fs.unlinkSync(req.file.path); // Clean up uploaded file
        return res.status(400).send("No package list was selected for import.");
    }

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        if (data.length === 0) {
            throw new Error("Excel sheet is empty.");
        }

        // Validate headers
        const requiredHeaders = ['name', 'mrp', 'b2b_price'];
        const actualHeaders = Object.keys(data[0]).map(h => h.trim().toLowerCase());
        const missingHeaders = requiredHeaders.filter(h => !actualHeaders.includes(h));
        if (missingHeaders.length > 0) {
            throw new Error(`Missing required columns in Excel file: ${missingHeaders.join(', ')}. Please ensure your columns are named exactly 'name', 'mrp', and 'b2b_price'.`);
        }
        
        const insertPackage = db.prepare(
            `INSERT INTO packages (name, mrp, b2b_price, package_list_id) 
             VALUES (?, ?, ?, ?)
             ON CONFLICT(name, package_list_id) DO UPDATE SET
             mrp=excluded.mrp, b2b_price=excluded.b2b_price`
        );

        const importTransaction = db.transaction((packages) => {
            for (const pkg of packages) {
                const name = pkg.name || pkg.Name;
                const mrp = parseFloat(pkg.mrp || pkg.MRP);
                const b2b_price = parseFloat(pkg.b2b_price || pkg['B2B_PRICE'] || pkg.b2b);

                if (name && !isNaN(mrp) && !isNaN(b2b_price)) {
                    insertPackage.run(String(name).trim(), mrp, b2b_price, list_id);
                } else {
                    console.warn("Skipping invalid row:", pkg);
                }
            }
        });

        importTransaction(data);
        console.log(`Successfully imported/updated ${data.length} packages for list ID ${list_id}.`);
        res.redirect("/admin/package-lists");

    } catch (err) {
        console.error("Excel import error:", err);
        res.status(500).send(`
            <h1>Import Failed</h1>
            <p><strong>Error:</strong> ${err.message}</p>
            <p>Please ensure your Excel file has columns named exactly: <strong>name</strong>, <strong>mrp</strong>, and <strong>b2b_price</strong>.</p>
            <a href="/admin/package-lists">Go Back</a>
        `);
    } finally {
        fs.unlinkSync(req.file.path); // Always clean up the uploaded file
    }
};