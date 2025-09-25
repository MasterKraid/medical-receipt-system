// server/labController.js

const db = require("./db");
const fs = require("fs");
const path = require("path");

// --- View/Manage Labs ---
exports.showManageLabsPage = (req, res) => {
    try {
        const labs = db.prepare(`SELECT id, name, logo_path FROM labs ORDER BY name`).all();
        const allLists = db.prepare(`SELECT id, name FROM package_lists ORDER BY name`).all();
        const assignments = db.prepare(`SELECT lab_id, package_list_id FROM lab_package_lists`).all();

        // Create a Map for easy lookup of assignments
        const labListMap = new Map();
        assignments.forEach(a => {
            if (!labListMap.has(a.lab_id)) {
                labListMap.set(a.lab_id, new Set());
            }
            labListMap.get(a.lab_id).add(a.package_list_id);
        });

        // Add assignment info to each lab object
        labs.forEach(lab => {
            lab.assigned_list_ids = labListMap.get(lab.id) || new Set();
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

    try {
        const oldPathResult = db.prepare("SELECT logo_path FROM labs WHERE id = ?").get(lab_id);
        const oldPath = oldPathResult ? oldPathResult.logo_path : null;

        const newFileName = `lab_${lab_id}${path.extname(req.file.originalname)}`;
        const newPathForDb = `/lab_logos/${newFileName}`;
        const finalFilePath = path.join(__dirname, "..", "public", "lab_logos", newFileName);

        fs.mkdirSync(path.dirname(finalFilePath), { recursive: true });
        fs.renameSync(req.file.path, finalFilePath);

        db.prepare("UPDATE labs SET logo_path = ? WHERE id = ?").run(newPathForDb, lab_id);

        if (oldPath && oldPath !== newPathForDb) {
            const oldFilesystemPath = path.join(__dirname, "..", "public", oldPath);
            if (fs.existsSync(oldFilesystemPath)) fs.unlinkSync(oldFilesystemPath);
        }

        res.redirect("/admin/labs");
    } catch (err) {
        console.error(`Error uploading logo for lab ${lab_id}:`, err);
        res.status(500).send("Error processing logo upload.");
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
