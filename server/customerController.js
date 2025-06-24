// medical_receipt_system/server/customerController.js
const db = require("./db");
const { formatDateForDisplay } = require('./utils/dateUtils');

// Helper to calculate age (used for display if not stored)
function calculateAge(dobString) {
    if (!dobString || !/^\d{4}-\d{2}-\d{2}$/.test(dobString)) return null;
    try {
        const birthDate = new Date(dobString + "T00:00:00Z");
        const today = new Date();
        let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
        const m = today.getUTCMonth() - birthDate.getUTCMonth();
        if (m < 0 || (m === 0 && today.getUTCDate() < birthDate.getUTCDate())) age--;
        return age >= 0 ? age : null;
    } catch (e) { return null; }
}

exports.searchCustomers = (req, res) => {
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 10;

    if (!query || query.trim().length < 1) {
        return res.json([]);
    }

    const searchTerm = `%${query.trim()}%`;
    const exactTerm = query.trim();

    try {
        let customers;
        const sql = `
            SELECT id, name, mobile, dob, age, gender
            FROM customers
            WHERE (id = ? AND ?) -- Placeholder for numeric check (bind 1 or 0)
               OR name LIKE ?
               OR (mobile IS NOT NULL AND mobile LIKE ?)
            ORDER BY
                CASE
                    WHEN id = ? AND ? THEN 1 -- Placeholder for numeric check (bind 1 or 0)
                    WHEN name LIKE ? THEN 2
                    WHEN mobile LIKE ? THEN 3
                    ELSE 4
                END
            LIMIT ?`;

        const isNumericQuery = /^\d+$/.test(exactTerm);
        const idQueryParam = isNumericQuery ? exactTerm : -1; // Use -1 if not numeric

        // *** FIX: Bind 1 for true, 0 for false instead of boolean ***
        const isNumericBindValue = isNumericQuery ? 1 : 0;

        customers = db.prepare(sql).all(
            idQueryParam,         // Param 1 (for ID = ?)
            isNumericBindValue,   // Param 2 (for AND ?) - NOW 1 or 0
            searchTerm,           // Param 3 (for name LIKE ?)
            searchTerm,           // Param 4 (for mobile LIKE ?)
            idQueryParam,         // Param 5 (for ORDER BY ID = ?)
            isNumericBindValue,   // Param 6 (for ORDER BY AND ?) - NOW 1 or 0
            searchTerm,           // Param 7 (for ORDER BY name LIKE ?)
            searchTerm,           // Param 8 (for ORDER BY mobile LIKE ?)
            limit                 // Param 9 (for LIMIT ?)
        );

        // Format results AFTER fetching
        const formattedCustomers = customers.map(cust => {
            const custIdFormatted = `CUST-${String(cust.id).padStart(10, '0')}`;
            const dobFormatted = formatDateForDisplay(cust.dob);
            let displayAge = 'N/A';
            if (cust.age !== null) {
                displayAge = `${cust.age} yrs`;
            } else {
                const calculatedAge = calculateAge(cust.dob);
                if (calculatedAge !== null) {
                    displayAge = `${calculatedAge} yrs`;
                }
            }
             const displayText = `${custIdFormatted} - ${cust.name} (${cust.mobile || 'No mobile'}) - DOB: ${dobFormatted || 'N/A'} / Age: ${displayAge}`;

            return {
                id: cust.id,
                name: cust.name,
                mobile: cust.mobile,
                dob: cust.dob,
                age: cust.age,
                gender: cust.gender,
                dob_formatted: dobFormatted,
                display_age: displayAge,
                display_text: displayText
            };
        });

        res.json(formattedCustomers);

    } catch (err) {
        // Log the error with more context
        console.error(`Error searching customers with query "${query}": ${err.message}\n${err.stack}`);
        res.status(500).json({ error: "Failed to search customers" });
    }
};