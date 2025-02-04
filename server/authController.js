const db = require('better-sqlite3')('./data/database.sqlite');

exports.login = (req, res) => {
    const { userId, password } = req.body;

    console.log(`🔍 Received credentials - User ID: ${userId}, Password: ${password}`);

    try {
        // Fetch user record
        const row = db.prepare('SELECT branch, password FROM users WHERE user_id = ?').get(userId);
        console.log(`📌 Database query result:`, row);

        if (!row) {
            console.log('❌ No matching user found.');
            return res.status(401).send('Invalid credentials');
        }

        // Validate password
        if (row.password !== password) {
            console.log('❌ Password does not match!');
            return res.status(401).send('Invalid credentials');
        }

        // ⚠️ Ensure session exists before setting values
        if (!req.session) {
            console.log('⚠️ Session not initialized! Possible session middleware issue.');
            return res.status(500).send('Session error, try again.');
        }

        req.session.branch = row.branch;
        console.log(`✅ Login successful! Assigned branch: ${req.session.branch}`);

        res.redirect('/form.html');
    } catch (err) {
        console.error('🔥 Error querying database:', err);
        res.status(500).send('Internal server error');
    }
};
