// medical_receipt_system/server/app.js
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");
require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); // Load .env file
const ejs = require("ejs");
const db = require("./db"); // Import the database connection
const rateLimit = require('express-rate-limit');

// --- Import Controllers and Middleware ---
const authController = require("./authController");
const receiptController = require("./receiptController");
const estimateController = require("./estimateController");
const packageController = require("./packageController");
const customerController = require("./customerController"); // <-- Import Customer Controller
const { isAuthenticated, isAdmin } = require("./authMiddleware");
const adminController = require("./adminController");

const app = express();
const PORT = process.env.PORT || 3000; // Use port from .env

// --- Middleware Setup ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
    session({
        secret: process.env.SESSION_SECRET, // Use secret from .env
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production', // Set to true if using HTTPS in production
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
    }),
);
app.use(express.static(path.join(__dirname, "..", "public")));

// --- Custom Middleware to load user/branch details ---
app.use((req, res, next) => {
    res.locals.sessionUser = req.session.user || null;
    res.locals.currentBranchDetails = null;
    if (req.session.user && req.session.user.branchId) {
        try {
            const branchStmt = db.prepare("SELECT id, name, address, phone FROM branches WHERE id = ?");
            res.locals.currentBranchDetails = branchStmt.get(req.session.user.branchId);
        } catch (dbError) {
            console.error("Middleware branch fetch error:", dbError);
        }
    }
    next();
});

// --- Route Definitions ---

// Root & Login/Logout
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
});

/*app.get("/", (req, res) => {
    // Redirect to intended URL or dashboard/receipt form after login
    const defaultRedirect = req.session.user
        ? (req.session.user.isAdmin ? "/admin-dashboard" : "/receipt-form")
        : null;
    const returnTo = req.session.returnTo || defaultRedirect;

    if (req.session.user && returnTo) {
         // Clear the returnTo session variable after using it
         // delete req.session.returnTo; // Do this in authController after redirect instead
        res.redirect(returnTo);
    } else if (req.session.user) {
        res.redirect(req.session.user.isAdmin ? "/admin-dashboard" : "/receipt-form"); // Fallback
    }
    else {
        res.sendFile(path.join(__dirname, "..", "public", "index.html"));
    }
});
uncommented for my sanity.*/

app.get("/", (req, res) => {
    // If a user session exists, redirect them to their appropriate dashboard.
    if (req.session.user) {
        const redirectUrl = req.session.user.isAdmin ? "/admin-dashboard" : "/dashboard";
        return res.redirect(redirectUrl);
    }

    // Otherwise, the user is not logged in, so show the login page.
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.post("/login", loginLimiter, authController.login);
app.get("/logout", authController.logout);

// User Dashboard
app.get("/dashboard", isAuthenticated, (req, res) => {
    // Simple render, no special data needed from controller
    res.render("user_dashboard");
});

// Route for users to view customers (reuses admin logic but could be separated)
app.get("/customers", isAuthenticated, adminController.viewCustomers);

// Estimate Routes (Protected)
app.get("/estimate-form", isAuthenticated, estimateController.showEstimateForm);
app.post("/estimate-submit", isAuthenticated, estimateController.createEstimate); // Will be updated
app.get("/estimate/:id", isAuthenticated, estimateController.showEstimate); // Will be updated

// Receipt Routes (Protected)
app.get("/receipt-form", isAuthenticated, receiptController.showReceiptForm);
app.post("/receipt-submit", isAuthenticated, receiptController.createReceipt); // Will be updated
app.get("/receipt/:id", isAuthenticated, receiptController.showReceipt); // Will be updated

// --- API Routes ---
app.get("/api/packages", isAuthenticated, packageController.getAllPackages);
app.get("/api/customers/search", isAuthenticated, customerController.searchCustomers); // <-- Add Customer Search API Route

// --- Admin Routes ---
app.get("/admin-dashboard", isAuthenticated, isAdmin, (req, res) => {
    // Pass user/branch info to admin dashboard as well
    res.render("admin_dashboard"); // Already available via middleware locals
});

// View Receipts & Estimates
app.get("/admin/receipts", isAuthenticated, isAdmin, adminController.viewReceipts);
app.get("/admin/estimates", isAuthenticated, isAdmin, adminController.viewEstimates);

// Manage Packages
app.get("/admin/packages", isAuthenticated, isAdmin, packageController.showManagePackagesPage);
app.post("/admin/packages/add", isAuthenticated, isAdmin, packageController.createPackage);
app.post("/admin/packages/edit/:id", isAuthenticated, isAdmin, packageController.updatePackage);

// View Customers
app.get("/admin/customers", isAuthenticated, isAdmin, adminController.viewCustomers);

// Manage Branches
app.get("/admin/branches", isAuthenticated, isAdmin, adminController.showManageBranchesPage);
app.post("/admin/branches/add", isAuthenticated, isAdmin, adminController.createBranch);
app.post("/admin/branches/edit/:id", isAuthenticated, isAdmin, adminController.updateBranch);

// Manage Users
app.get("/admin/users", isAuthenticated, isAdmin, adminController.showManageUsersPage);
app.post("/admin/users/add", isAuthenticated, isAdmin, adminController.createUser);
// Note: User editing is more complex and can be added later following the same pattern.

// Add other admin routes later...

// --- Optional: Central Error Handler ---
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack || err);
  res.status(500).render('error_general', {
    title: "Server Error",
    message: "An unexpected error occurred on the server.",
    // Only show stack trace in development environment for security
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});


// --- Server Startup ---
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    // db.js handles its own console logs now
});