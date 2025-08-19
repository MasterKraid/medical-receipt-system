// medical_receipt_system/server/authController.js
const db = require("./db");
const bcrypt = require("bcrypt"); // Assuming bcrypt (sync version used as per original code)

exports.login = (req, res) => {
  const { userId, password } = req.body;
  const username = userId; // Map form field to username

  if (!username || !password) {
    // Redirect back to login page with an error query parameter
    return res.redirect('/?error=missing');
  }
  console.log(`Attempting login for Username: ${username}`);

  try {
    const stmt = db.prepare(
      "SELECT id, username, password_hash, branch_id, is_admin FROM users WHERE username = ?",
    );
    const user = stmt.get(username);

    if (!user) {
      console.log(`Login failed: No user found with username ${username}.`);
      // Redirect back to login page with an error query parameter
      return res.redirect('/?error=invalid');
    }

    // Verify password using bcrypt (sync version as per original code)
    // Note: Async version (bcrypt.compare) is generally preferred in Node.js
    const passwordIsValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordIsValid) {
      console.log(`Login failed: Password mismatch for username ${username}.`);
      // Redirect back to login page with an error query parameter
      return res.redirect('/?error=invalid');
    }

    // --- Prepare user data for the session ---
    if (user.branch_id === undefined || user.branch_id === null) {
      console.error(`CRITICAL: User ${user.id} (${user.username}) has null or undefined branch_id!`);
      // Redirect back to login page with a generic error
       return res.redirect('/?error=server');
    }
    const userDataForSession = {
      id: user.id,
      username: user.username,
      branchId: user.branch_id,
      isAdmin: Boolean(user.is_admin), // Ensure it's a boolean
    };
    console.log(`Login successful for User ID: ${userDataForSession.id}. Data to store:`, userDataForSession);

    // Regenerate session ID upon login for security (good practice)
    req.session.regenerate((err) => {
      if (err) {
        console.error("Error regenerating session:", err);
         // Redirect back to login page with a generic error
         return res.redirect('/?error=session');
      }

      // Restore user data to the NEW session
      req.session.user = userDataForSession;
      console.log("Session regenerated. User data restored to new session.");

      // Check if there was a URL the user was trying to access before login
      const returnTo = req.session.returnTo || (userDataForSession.isAdmin ? '/admin-dashboard' : '/dashboard');
      delete req.session.returnTo; // Clear the stored URL

      // Save the session explicitly before redirecting (recommended)
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Error saving session after regenerate:", saveErr);
          // Proceed with redirect anyway, but log the error
        }
        console.log(`Redirecting logged-in user to: ${returnTo}`);
        res.redirect(returnTo);
      });
    });

  } catch (dbError) {
    console.error("Database error during login:", dbError);
     // Redirect back to login page with a generic error
     res.redirect('/?error=server');
  }
};

// Logout Handler (remains the same)
exports.logout = (req, res) => {
  const username = req.session.user ? req.session.user.username : "Unknown user";
  req.session.destroy((err) => {
    if (err) {
      console.error(`Session destruction error for user ${username}:`, err);
       // Still redirect, but maybe log more severely
        res.redirect("/");
    } else {
      console.log(`User ${username} logged out successfully.`);
      // Clear the cookie client-side as well (optional, session destroy should handle server-side)
       // res.clearCookie('connect.sid'); // Name depends on session config, usually 'connect.sid'
       res.redirect("/"); // Redirect to login page
    }
  });
};