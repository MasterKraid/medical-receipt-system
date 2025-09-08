// medical_receipt_system/server/locationController.js
const db = require("./db");

// Get all test locations for datalist
exports.getAllLocations = (req, res) => {
  try {
    const stmt = db.prepare("SELECT id, name FROM test_locations ORDER BY name COLLATE NOCASE");
    const locations = stmt.all();
    res.json(locations);
  } catch (err) {
    console.error("Error fetching test locations:", err);
    res.status(500).json({ error: "Failed to retrieve locations" });
  }
};