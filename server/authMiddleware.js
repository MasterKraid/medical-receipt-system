// medical_receipt_system/server/authMiddleware.js

// Middleware to check if the user is authenticated
exports.isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.id) {
    // User is logged in, make user info easily available in templates if not already done globally
    res.locals.sessionUser = req.session.user;
    return next();
  } else {
    console.log("Authentication required. Redirecting to login.");
    // Store the original URL they tried to access, so we can redirect back after login
    req.session.returnTo = req.originalUrl;
    res.redirect("/"); // Redirect to login page
  }
};

// Middleware to check if the user is an admin
exports.isAdmin = (req, res, next) => {
  // Ensure user is authenticated first before checking admin status
  if (!req.session || !req.session.user || !req.session.user.id) {
      console.log("Admin check failed: User not authenticated.");
      req.session.returnTo = req.originalUrl; // Store intended URL
      return res.redirect("/"); // Redirect to login
  }

  // Now check if the authenticated user is an admin
  if (req.session.user.isAdmin) {
      res.locals.sessionUser = req.session.user; // Ensure available in admin templates too
      return next(); // User is an admin, proceed
  } else {
      // Logged in but not an admin
      console.log(`Admin access denied for user: ${req.session.user.username} (ID: ${req.session.user.id})`);
      // Send a more user-friendly forbidden page/message
      res.status(403).render('error_forbidden', { // Assuming you create an EJS view for this
           message: "You do not have administrative privileges to access this page.",
           title: "Access Denied" ,
           sessionUser: req.session.user // Pass user info for potential header/layout
         });

      /* // --- OR --- Send simpler HTML if no dedicated view
      res.status(403).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head><title>Forbidden</title><link rel="stylesheet" href="/styles.css"></head>
            <body style="padding: 30px;">
                <h1>403 - Forbidden</h1>
                <p>You do not have administrative privileges to access this page.</p>
                <p>Logged in as: ${req.session.user.username}</p>
                <hr>
                <p><a href="/">Go to Dashboard/Login</a> | <a href="javascript:history.back()">Go Back</a></p>
            </body>
            </html>
        `);
       */
  }
};