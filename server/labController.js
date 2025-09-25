// server/labController.js

const db = require("./db");
const fs = require("fs");
const path = require("path");

// --- View/Manage Labs ---
exports.showManageLabsPage = (req, res) => {
    try {
        const labs = db.prepare(`
            SELECT 
                l.id, l.name, l.logo_path,
                (SELECT GROUP_CONCAT(pl.name, ', ') 
                 FROM lab_package_lists j 
                 JOIN package_lists pl ON j.package_list_id = pl.id 
                 WHERE j.lab_id = l.id) as assigned_list_names
            FROM labs l 
            ORDER BY l.name
        `).all();

        const allLists = db.prepare(`SELECT id, name FROM package_lists ORDER BY name`).all();
        const assignments = db.prepare(`SELECT lab_id, package_list_id FROM lab_package_lists`).all();

        const labListMap = new Map();
        assignments.forEach(a => {
            if (!labListMap.has(a.lab_id)) {
                labListMap.set(a.lab_id, new Set());
            }
            labListMap.get(a.lab_id).add(a.package_list_id);
        });

        labs.forEach(lab => {
            lab.assigned_list_ids = Array.from(labListMap.get(lab.id) || new Set());
        });

        res.render("admin/manage_labs", { labs, allLists });
    } catch (err) {
        console.error("Error loading manage labs page:", err);
        res.status(500).send("Could not load page.");
    }
};


// --- Create a new lab ---
exports.createLab = (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).send("Lab name is required.");

    try {
        const info = db.prepare("INSERT INTO labs (name) VALUES (?)").run(name);
        console.log(`Created new lab '${name}' with ID ${info.lastInsertRowid}`);
        res.redirect("/admin/labs");
    } catch (err) {
        if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).send("A lab with this name already exists.");
        }
        console.error("Error creating lab:", err);
        res.status(500).send("Error creating lab.");
    }
};

// --- Upload or replace lab logo ---
exports.uploadLogo = (req, res) => {
    const { lab_id } = req.body;
    if (!req.file) return res.status(400).send("No image file uploaded.");
    if (!lab_id) return res.status(400).send("Lab ID is missing.");

    const tempPath = req.file.path;

    try {
        const oldPathResult = db.prepare("SELECT logo_path FROM labs WHERE id = ?").get(lab_id);
        const oldPath = oldPathResult ? oldPathResult.logo_path : null;

        const newFileName = `lab_${lab_id}${path.extname(req.file.originalname)}`;
        const newPathForDb = `/lab_logos/${newFileName}`;
        const finalFilePath = path.join(__dirname, "..", "public", "lab_logos", newFileName);

        // Ensure the target directory exists
        fs.mkdirSync(path.dirname(finalFilePath), { recursive: true });

        // Safer: Copy the file, then delete the temporary one.
        fs.copyFileSync(tempPath, finalFilePath);

        db.prepare("UPDATE labs SET logo_path = ? WHERE id = ?").run(newPathForDb, lab_id);

        // Clean up old logo if it's different from the new one
        if (oldPath && oldPath !== newPathForDb) {
            const oldFilesystemPath = path.join(__dirname, "..", "public", oldPath);
            if (fs.existsSync(oldFilesystemPath)) {
                fs.unlinkSync(oldFilesystemPath);
            }
        }

        res.redirect("/admin/labs");
    } catch (err) {
        // More detailed error logging for debugging
        console.error(`Error uploading logo for lab ${lab_id}:`, err);
        res.status(500).send("Error processing logo upload.");
    } finally {
        // ALWAYS clean up the temporary file from multer
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
    }
};

// --- Update lab's package list assignments (many-to-many) ---
exports.updateLabLists = (req, res) => {
    const { lab_id, package_list_ids } = req.body;

    try {
        db.transaction(() => {
            // Remove old assignments
            db.prepare("DELETE FROM lab_package_lists WHERE lab_id = ?").run(lab_id);

            // Insert new assignments
            if (package_list_ids) {
                const insert = db.prepare("INSERT INTO lab_package_lists (lab_id, package_list_id) VALUES (?, ?)");
                const ids = Array.isArray(package_list_ids) ? package_list_ids : [package_list_ids];
                for (const listId of ids) insert.run(lab_id, listId);
            }
        })();

        res.redirect("/admin/labs");
    } catch (err) {
        console.error(`Error updating package lists for lab ${lab_id}:`, err);
        res.status(500).send("Error updating lab assignments.");
    }
};

// --- Old assignPackageList is deleted ---
