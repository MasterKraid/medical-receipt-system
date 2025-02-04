const db = require('better-sqlite3')('./data/database.sqlite');

exports.saveReceipt = (req, res) => {
    const { customerName, feeDetails, amount, branch } = req.body;

    // Check required fields and handle missing data
    if (!customerName || !feeDetails || !amount || !branch) {
        return res.status(400).send("Missing required fields.");
    }

    try {
        const stmt = db.prepare(
            'INSERT INTO receipts (customer_name, branch, fee_details, amount) VALUES (?, ?, ?, ?)'
        );
        stmt.run(customerName, branch, JSON.stringify(feeDetails), amount);

        res.redirect('/receipt');
    } catch (err) {
        console.error('Error saving receipt:', err);
        res.status(500).send('Internal server error');
    }
};
