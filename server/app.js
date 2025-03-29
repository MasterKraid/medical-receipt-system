// medical_receipt_system/server/app.js
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");
const ejs = require("ejs");
const db = require("./db"); // Import the database connection

// Import Controllers and Middleware (ONCE at the top)
const authController = require("./authController");
const receiptController = require("./receiptController");
const estimateController = require("./estimateController");
const packageController = require("./packageController");
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

// --- Custom Middleware ---

// Middleware to load user and branch details into locals if logged in
app.use((req, res, next) => {
  res.locals.sessionUser = req.session.user || null;
  res.locals.currentBranchDetails = null;

  if (req.session.user && req.session.user.branchId) {
    try {
      const branchStmt = db.prepare(
        "SELECT id, name, address, phone FROM branches WHERE id = ?",
      );
      res.locals.currentBranchDetails = branchStmt.get(
        req.session.user.branchId,
      );
    } catch (dbError) {
      console.error("Middleware branch fetch error:", dbError);
    }
  }
  next();
});

// --- Route Definitions ---

// REMOVED Duplicate require('./authMiddleware') from here

// Root & Login/Logout
app.get("/", (req, res) => {
  if (req.session.user) {
    res.redirect(
      req.session.user.isAdmin ? "/admin-dashboard" : "/receipt-form",
    );
  } else {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  }
});
app.post("/login", authController.login);
app.get("/logout", authController.logout);

// Estimate Routes (Protected)
app.get("/estimate-form", isAuthenticated, estimateController.showEstimateForm);
app.post(
  "/estimate-submit",
  isAuthenticated,
  estimateController.createEstimate,
);
app.get("/estimate/:id", isAuthenticated, estimateController.showEstimate);

// Receipt Routes (Protected)
app.get("/receipt-form", isAuthenticated, receiptController.showReceiptForm);
app.post("/receipt-submit", isAuthenticated, receiptController.createReceipt);
app.get("/receipt/:id", isAuthenticated, receiptController.showReceipt);

// --- API Routes ---
app.get("/api/packages", isAuthenticated, packageController.getAllPackages);

// --- Admin Routes ---
app.get("/admin-dashboard", isAuthenticated, isAdmin, (req, res) => {
  res.render("admin_dashboard");
});

// Add other admin routes later, like:
// app.get('/admin/branches', isAuthenticated, isAdmin, adminController.listBranches);

// --- Server Startup ---
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("DB schema init from db.js.");
});
