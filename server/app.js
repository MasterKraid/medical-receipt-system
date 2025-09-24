// medical_receipt_system/server/app.js
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");
const multer = require('multer');
const os = require('os');
require("dotenv").config({ path: path.join(__dirname, "..", ".env") }); // Load .env file
const ejs = require("ejs");
const db = require("./db"); // Import the database connection
const rateLimit = require("express-rate-limit");

// --- Import Controllers and Middleware ---
const authController = require("./authController");
const receiptController = require("./receiptController");
const estimateController = require("./estimateController");
const packageController = require("./packageController");
const packageListController = require("./packageListController");
const customerController = require("./customerController");
const { isAuthenticated, isAdmin, hasPermission } = require("./authMiddleware");
const adminController = require("./adminController");
const locationController = require("./locationController");

const app = express();
const PORT = process.env.PORT || 3000; // Use port from .env

// Multer config for temp file storage
const upload = multer({ dest: os.tmpdir() });

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
      secure: process.env.NODE_ENV === "production", // Set to true if using HTTPS in production
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
      const branchStmt = db.prepare(
        "SELECT id, name, address, phone FROM branches WHERE id = ?"
      );
      res.locals.currentBranchDetails = branchStmt.get(
        req.session.user.branchId
      );
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
  standardHeaders: true,
  legacyHeaders: false,
  message:
    "Too many login attempts from this IP, please try again after 15 minutes",
});

app.get("/", (req, res) => {
  if (req.session.user) {
    // Use role to determine dashboard
    const redirectUrl =
      req.session.user.role === "ADMIN" ? "/admin-dashboard" : "/dashboard";
    return res.redirect(redirectUrl);
  }

  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.post("/login", loginLimiter, authController.login);
app.get("/logout", authController.logout);

// --- User Dashboard ---
app.get("/dashboard", isAuthenticated, (req, res) => {
  if (req.session.user.role === "ADMIN") {
    return res.redirect("/admin-dashboard");
  }
  res.render("user_dashboard");
});

// --- Customers (accessible to logged-in users) ---
app.get("/customers", isAuthenticated, adminController.viewCustomers);

// --- Estimate Routes (Protected: any authenticated user) ---
app.get("/estimate-form", isAuthenticated, estimateController.showEstimateForm);
app.post("/estimate-submit", isAuthenticated, estimateController.createEstimate);
app.get("/estimate/:id", isAuthenticated, estimateController.showEstimate);

// --- Receipt Routes (Protected: only Admin + General Employee) ---
app.get(
  "/receipt-form",
  isAuthenticated,
  hasPermission(["ADMIN", "GENERAL_EMPLOYEE"]),
  receiptController.showReceiptForm
);
app.post(
  "/receipt-submit",
  isAuthenticated,
  hasPermission(["ADMIN", "GENERAL_EMPLOYEE"]),
  receiptController.createReceipt
);
app.get("/receipt/:id", isAuthenticated, receiptController.showReceipt);

// --- API Routes ---
app.get("/api/packages", isAuthenticated, packageController.getAllPackages);
app.get(
  "/api/customers/search",
  isAuthenticated,
  customerController.searchCustomers
);
app.get("/api/locations", isAuthenticated, locationController.getAllLocations);

// --- Admin Routes ---
app.get("/admin-dashboard", isAuthenticated, isAdmin, (req, res) => {
  res.render("admin_dashboard");
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

// Manage Package Lists & Import (NEW)
app.get("/admin/package-lists", isAuthenticated, isAdmin, packageListController.showManageListsPage);
app.post("/admin/package-lists/add", isAuthenticated, isAdmin, packageListController.createList);
app.post("/admin/packages/upload", isAuthenticated, isAdmin, upload.single('package_file'), packageListController.uploadPackages);

// Manage Users
app.get("/admin/users", isAuthenticated, isAdmin, adminController.showManageUsersPage);
app.post("/admin/users/add", isAuthenticated, isAdmin, adminController.createUser);
app.post("/admin/users/delete/:id", isAuthenticated, isAdmin, adminController.deleteUser);
// Note: User editing is more complex and can be added later following the same pattern.

// --- Central Error Handler ---
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack || err);
  res.status(500).render("error_general", {
    title: "Server Error",
    message: "An unexpected error occurred on the server.",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

// --- Server Startup ---
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  // db.js handles its own console logs
});
