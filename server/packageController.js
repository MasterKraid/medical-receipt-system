// medical_receipt_system/server/packageController.js
const db = require("./db");

// Get all packages for dropdown/datalist
exports.getAllPackages = (req, res) => {
  try {
    // Select only necessary fields
    const stmt = db.prepare(
      "SELECT id, name, mrp FROM packages ORDER BY name COLLATE NOCASE",
    );
    const packages = stmt.all();
    res.json(packages); // Send data as JSON
  } catch (err) {
    console.error("Error fetching packages:", err);
    res.status(500).json({ error: "Failed to retrieve packages" });
  }
};

// --- Add functions later for creating/updating/deleting packages via admin panel ---
// exports.createPackage = (req, res) => { ... }
// exports.updatePackage = (req, res) => { ... }
// exports.deletePackage = (req, res) => { ... }
