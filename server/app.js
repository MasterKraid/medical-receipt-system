// medical_receipt_system/server/app.js
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");
const ejs = require("ejs");
const db = require("./db"); // Import the database connection

// --- Import Controllers and Middleware ---
const authController = require("./authController");
const receiptController = require("./receiptController");
const estimateController = require("./estimateController");
const packageController = require("./packageController");
const customerController = require("./customerController"); // <-- Import Customer Controller
const { isAuthenticated, isAdmin } = require("./authMiddleware");

const app = express();
const PORT = 3000;

// --- Middleware Setup ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
    session({
        secret: "a-much-better-secret-key-please-change", // ** CHANGE THIS!! **
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, // Set to true if using HTTPS
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
app.get("/", (req, res) => {
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
app.post("/login", authController.login);
app.get("/logout", authController.logout);

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

// Add other admin routes later...

// --- Optional: Central Error Handler ---
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack || err);
  res.status(500).render('error_general', { // Assuming you create views/error_general.ejs
    title: "Server Error",
    message: "An unexpected error occurred.",
    error: process.env.NODE_ENV === 'development' ? err : {} // Only show stack in dev
  });
});


// --- Server Startup ---
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    // db.js handles its own console logs now
});