// medical_receipt_system/server/authMiddleware.js

// Middleware to check if the user is authenticated
exports.isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.id) {
    // User is logged in, make user info easily available in templates
    res.locals.sessionUser = req.session.user;
    return next();
  } else {
    console.log("Authentication required. Redirecting to login.");
    // Store the original URL they tried to access for post-login redirect
    req.session.returnTo = req.originalUrl;
    res.redirect("/"); // Redirect to login page
  }
};

// NEW: Flexible role-based permission middleware
exports.hasPermission = (allowedRoles = []) => {
  return (req, res, next) => {
    // This middleware must run *after* isAuthenticated
    const userRole = req.session.user ? req.session.user.role : null;

    if (userRole && allowedRoles.includes(userRole)) {
      return next(); // User has the required role, proceed
    }

    // Logged in but not the correct role, or not logged in at all
    console.log(
      `Access denied for user: ${
        req.session.user ? req.session.user.username : "Guest"
      }. Role: ${userRole}. Required: ${allowedRoles.join(", ")}`
    );

    res.status(403).render("error_forbidden", {
      message: "You do not have the required permissions to access this page.",
      title: "Access Denied",
      sessionUser: req.session.user || null,
    });
  };
};

// OLD isAdmin is now just a specific use of hasPermission
exports.isAdmin = exports.hasPermission(["ADMIN"]);
