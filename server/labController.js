//server/labController.js

const db = require("./db");
const fs = require("fs");
const path = require("path");

// --- View/Manage Labs ---
exports.showManageLabsPage = (req, res) => {
    try {
        const labs = db.prepare(`
            SELECT 
                l.id, l.name, l.logo_path, pl.id as package_list_id, pl.name as package_list_name,
                (SELECT COUNT(*) FROM packages WHERE package_list_id = pl.id) as package_count
            FROM labs l
            LEFT JOIN package_lists pl ON l.package_list_id = pl.id
            ORDER BY l.name
        `).all();

        // Also get unassigned package lists for the dropdown
        const unassignedLists = db.prepare(`
            SELECT id, name FROM package_lists 
            WHERE id NOT IN (SELECT package_list_id FROM labs WHERE package_list_id IS NOT NULL)
            ORDER BY name
        `).all();

        res.render("admin/manage_labs", { labs, unassignedLists });
    } catch (err) {
        console.error("Error loading manage labs page:", err);
        res.status(500).send("Could not load page.");
    }
};

exports.createLab = (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).send("Lab name is required.");
    try {
        const info = db.prepare("INSERT INTO labs (name) VALUES (?)").run(name);
        console.log(`Created new lab '${name}' with ID ${info.lastInsertRowid}`);
        res.redirect("/admin/labs");
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).send("A lab with this name already exists.");
        }
        console.error("Error creating lab:", err);
        res.status(500).send("Error creating lab.");
    }
};

exports.uploadLogo = (req, res) => {
    const { lab_id } = req.body;
    if (!req.file) return res.status(400).send("No image file uploaded.");
    if (!lab_id) return res.status(400).send("Lab ID is missing.");

    try {
        // Get old logo path to delete it later
        const oldPathResult = db.prepare("SELECT logo_path FROM labs WHERE id = ?").get(lab_id);
        const oldPath = oldPathResult ? oldPathResult.logo_path : null;

        // The path to store the logo will be relative to the public directory
        const newFileName = `lab_${lab_id}${path.extname(req.file.originalname)}`;
        const newPathForDb = `/lab_logos/${newFileName}`; // Path to be stored in DB
        const finalFilePath = path.join(__dirname, '..', 'public', 'lab_logos', newFileName); // Actual filesystem path

        // Ensure the directory exists
        fs.mkdirSync(path.dirname(finalFilePath), { recursive: true });
        
        // Move the file from temp location to final destination
        fs.renameSync(req.file.path, finalFilePath);

        // Update database
        db.prepare("UPDATE labs SET logo_path = ? WHERE id = ?").run(newPathForDb, lab_id);
        
        // Delete the old logo if it exists and is not the same as the new one
        if (oldPath && oldPath !== newPathForDb) {
            const oldFilesystemPath = path.join(__dirname, '..', 'public', oldPath);
            if (fs.existsSync(oldFilesystemPath)) {
                fs.unlinkSync(oldFilesystemPath);
            }
        }
        
        res.redirect("/admin/labs");
    } catch (err) {
        console.error(`Error uploading logo for lab ${lab_id}:`, err);
        res.status(500).send("Error processing logo upload.");
    }
};

exports.assignPackageList = (req, res) => {
    const { lab_id, package_list_id } = req.body;
    if (!lab_id || !package_list_id) {
        return res.status(400).send("Missing Lab ID or Package List ID.");
    }
    try {
        db.prepare("UPDATE labs SET package_list_id = ? WHERE id = ?").run(package_list_id, lab_id);
        res.redirect("/admin/labs");
    } catch (err) {
        console.error(`Error assigning list ${package_list_id} to lab ${lab_id}:`, err);
        res.status(500).send("Database error during assignment.");
    }
};