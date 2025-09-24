// medical_receipt_system/server/authController.js
const db = require("./db");
const bcrypt = require("bcrypt"); // Using bcrypt sync version as per existing code

exports.login = (req, res) => {
  const { userId, password } = req.body;
  const username = userId; // Map form field to username

  if (!username || !password) {
    // Redirect back to login page with an error query parameter
    return res.redirect("/?error=missing");
  }
  console.log(`Attempting login for Username: ${username}`);

  try {
    // --- Fetch user data ---
    const stmt = db.prepare(
      "SELECT id, username, password_hash, branch_id, role, package_list_id FROM users WHERE username = ?"
    );
    const user = stmt.get(username);

    if (!user) {
      console.log(`Login failed: No user found with username ${username}.`);
      return res.redirect("/?error=invalid");
    }

    // --- Validate password ---
    const passwordIsValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordIsValid) {
      console.log(`Login failed: Password mismatch for username ${username}.`);
      return res.redirect("/?error=invalid");
    }

    // --- Prepare user data for the session ---
    if (user.branch_id === undefined || user.branch_id === null) {
      console.error(
        `CRITICAL: User ${user.id} (${user.username}) has null or undefined branch_id!`
      );
      return res.redirect("/?error=server");
    }

    const userDataForSession = {
      id: user.id,
      username: user.username,
      branchId: user.branch_id,
      role: user.role, // <-- New field
      packageListId: user.package_list_id, // <-- New field
      // isAdmin is now deprecated, role is used instead
    };

    console.log(
      `Login successful for User ID: ${userDataForSession.id}. Data to store:`,
      userDataForSession
    );

    // --- Regenerate session ID for security ---
    req.session.regenerate((err) => {
      if (err) {
        console.error("Error regenerating session:", err);
        return res.redirect("/?error=session");
      }

      // Store user data in new session
      req.session.user = userDataForSession;
      console.log("Session regenerated. User data restored to new session.");

      // Redirect user to their intended page or dashboard
      const returnTo =
        req.session.returnTo ||
        (userDataForSession.role === "ADMIN"
          ? "/admin-dashboard"
          : "/dashboard");
      delete req.session.returnTo;

      // Save session before redirect
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Error saving session after regenerate:", saveErr);
        }
        console.log(`Redirecting logged-in user to: ${returnTo}`);
        res.redirect(returnTo);
      });
    });
  } catch (dbError) {
    console.error("Database error during login:", dbError);
    res.redirect("/?error=server");
  }
};

// Logout Handler
exports.logout = (req, res) => {
  const username = req.session.user ? req.session.user.username : "Unknown user";
  req.session.destroy((err) => {
    if (err) {
      console.error(`Session destruction error for user ${username}:`, err);
      res.redirect("/");
    } else {
      console.log(`User ${username} logged out successfully.`);
      res.redirect("/");
    }
  });
};
