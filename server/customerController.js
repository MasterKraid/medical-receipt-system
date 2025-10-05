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
    const userRole = req.session.user.role;
    const userId = req.session.user.id;
    
    // Prevent overly long queries which could be used for DoS attacks
    if (query && query.length > 100) {
        return res.status(400).json({ error: "Search query is too long." });
    }

    if (!query || query.trim().length < 1) {
        return res.json([]);
    }

    const searchTerm = `%${query.trim()}%`;
    const exactTerm = query.trim();

    try {
        let sql = `
            SELECT id, name, mobile, dob, age, gender
            FROM customers
        `;
        let params = [];
        const whereClauses = [];

        if (userRole === 'CLIENT') {
            whereClauses.push(`created_by_user_id = ?`);
            params.push(userId);
        }
        
        const isNumericQuery = /^\d+$/.test(exactTerm);
        whereClauses.push(`( (id = ? AND ?) OR name LIKE ? OR (mobile IS NOT NULL AND mobile LIKE ?) )`);
        params.push(isNumericQuery ? exactTerm : -1, isNumericQuery ? 1 : 0, searchTerm, searchTerm);
        
        sql += ` WHERE ` + whereClauses.join(' AND ');

        sql += `
            ORDER BY
                CASE
                    WHEN id = ? AND ? THEN 1
                    WHEN name LIKE ? THEN 2
                    WHEN mobile LIKE ? THEN 3
                    ELSE 4
                END
            LIMIT ?`;

        const customers = db.prepare(sql).all(
            ...params,                     // Params for the dynamically built WHERE clause
            isNumericQuery ? exactTerm : -1, // Param for ORDER BY ID
            isNumericQuery ? 1 : 0,        // Param for ORDER BY AND
            searchTerm,                    // Param for ORDER BY name
            searchTerm,                    // Param for ORDER BY mobile
            limit                          // Param for LIMIT
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