// medical_receipt_system/server/app.js
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const FileStore = require('session-file-store')(session);
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
const packageListController = require("./packageListController");
const customerController = require("./customerController");
const { isAuthenticated, isAdmin, hasPermission } = require("./authMiddleware");
const adminController = require("./adminController");
const labController = require("./labController");

const app = express();
const PORT = process.env.PORT || 3000; // Use port from .env

// Multer config for temp file storage
const upload = multer({ dest: os.tmpdir() });

// --- Middleware Setup ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/lab_logos', express.static(path.join(__dirname, '..', 'public', 'lab_logos')));

// This line initializes the session store.
const fileStoreOptions = {
    path: path.join(__dirname, '..', 'sessions'), // Creates a /sessions folder
    logFn: function() {}, // Disables verbose logging to keep the console clean
    reapInterval: 3600 // Clean up expired sessions every hour
};

app.use(
  session({
    store: new FileStore(fileStoreOptions),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true if using HTTPS in production
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
  
  let walletBalance = 0;
  if (req.session.user.role === "CLIENT") {
    try {
      const walletData = db.prepare("SELECT wallet_balance FROM users WHERE id = ?").get(req.session.user.id);
      walletBalance = walletData ? walletData.wallet_balance : 0;
    } catch (err) {
      console.error("Error fetching wallet balance:", err);
    }
  }
  
  res.render("user_dashboard", { walletBalance });
});

// --- Customers (accessible to logged-in users) ---
app.get("/customers", isAuthenticated, adminController.viewCustomers);
app.get("/admin/customers/edit/:id", isAuthenticated, isAdmin, adminController.showEditCustomerPage);
app.post("/admin/customers/edit/:id", isAuthenticated, isAdmin, adminController.updateCustomer);

// --- Estimate Routes (Protected: any authenticated user) ---
app.get("/estimate-form", isAuthenticated, estimateController.showEstimateForm);
app.post("/estimate-submit", isAuthenticated, estimateController.createEstimate);
app.get("/estimate/:id", isAuthenticated, estimateController.showEstimate);

// --- Receipt Routes (Protected: only Admin + General Employee) ---
app.get(
  "/receipt-form",
  isAuthenticated,
  hasPermission(["ADMIN", "GENERAL_EMPLOYEE", "CLIENT"]),
  receiptController.showReceiptForm
);
app.post(
  "/receipt-submit",
  isAuthenticated,
  hasPermission(["ADMIN", "GENERAL_EMPLOYEE", "CLIENT"]),
  receiptController.createReceipt
);
app.get("/receipt/:id", isAuthenticated, receiptController.showReceipt);

// --- API Routes ---
app.get("/api/user-labs", isAuthenticated, (req, res) => {
    try {
        const userId = req.session.user.id;
        const userRole = req.session.user.role;
        let labs;
        if (userRole === 'ADMIN') {
            // Admins can see all labs
            labs = db.prepare(`SELECT DISTINCT l.id, l.name FROM labs l ORDER BY l.name`).all();
        } else {
            // Other users see labs that have at least one list they are assigned to
            labs = db.prepare(`
                SELECT DISTINCT l.id, l.name FROM labs l
                JOIN lab_package_lists lpl ON l.id = lpl.lab_id
                JOIN user_package_list_access upla ON lpl.package_list_id = upla.package_list_id
                WHERE upla.user_id = ?
                ORDER BY l.name
            `).all(userId);
        }
        res.json(labs);
    } catch (err) { res.status(500).json({ error: "Failed to get user labs" }); }
});

app.get("/api/user-lists-for-lab", isAuthenticated, (req, res) => {
    const { labId } = req.query;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    try {
        let lists;
        if (userRole === 'ADMIN') {
            // Admins see all lists associated with the selected lab
            lists = db.prepare(`
                SELECT pl.id, pl.name FROM package_lists pl
                JOIN lab_package_lists lpl ON pl.id = lpl.package_list_id
                WHERE lpl.lab_id = ? ORDER BY pl.name
            `).all(labId);
        } else {
            // Others see only the lists for that lab they have been granted access to
            lists = db.prepare(`
                SELECT pl.id, pl.name FROM package_lists pl
                JOIN lab_package_lists lpl ON pl.id = lpl.package_list_id
                JOIN user_package_list_access upla ON pl.id = upla.package_list_id
                WHERE lpl.lab_id = ? AND upla.user_id = ?
                ORDER BY pl.name
            `).all(labId, userId);
        }
        res.json(lists);
    } catch (err) { res.status(500).json({ error: "Failed to get lists for lab" }); }
});

app.get("/api/packages-for-list", isAuthenticated, (req, res) => {
    const { listId } = req.query;
    try {
        const packages = db.prepare(
            "SELECT name, mrp, b2b_price FROM packages WHERE package_list_id = ? ORDER BY name"
        ).all(listId);
        res.json(packages);
    } catch (err) { res.status(500).json({ error: "Failed to get packages" }); }
});
app.get("/api/customers/search", isAuthenticated, customerController.searchCustomers);

// --- Admin Routes ---
app.get("/admin-dashboard", isAuthenticated, isAdmin, (req, res) => {
  res.render("admin_dashboard");
});

// View Receipts & Estimates
app.get("/admin/receipts", isAuthenticated, isAdmin, adminController.viewReceipts);
app.get("/admin/estimates", isAuthenticated, isAdmin, adminController.viewEstimates);

// Manage Packages and Labs
app.get("/admin/labs", isAuthenticated, isAdmin, labController.showManageLabsPage);
app.post("/admin/labs/add", isAuthenticated, isAdmin, labController.createLab);
app.post("/admin/labs/upload-logo", isAuthenticated, isAdmin, upload.single('logo_file'), labController.uploadLogo);
app.post("/admin/labs/update-lists", isAuthenticated, isAdmin, labController.updateLabLists);
app.get("/admin/package-lists", isAuthenticated, isAdmin, packageListController.showManageListsPage);
app.post("/admin/package-lists/add", isAuthenticated, isAdmin, packageListController.createList);
app.post("/admin/packages/upload", isAuthenticated, isAdmin, upload.single('package_file'), packageListController.uploadPackages);
app.post("/admin/packages/add-to-list", isAuthenticated, isAdmin, packageListController.addPackageToList); 
app.post("/admin/packages/update", isAuthenticated, isAdmin, packageListController.updatePackageInList); 

// View Customers
app.get("/admin/customers", isAuthenticated, isAdmin, adminController.viewCustomers);

// Manage Branches
app.get("/admin/branches", isAuthenticated, isAdmin, adminController.showManageBranchesPage);
app.post("/admin/branches/add", isAuthenticated, isAdmin, adminController.createBranch);
app.post("/admin/branches/edit/:id", isAuthenticated, isAdmin, adminController.updateBranch);

// Manage Users
app.get("/admin/users", isAuthenticated, isAdmin, adminController.showManageUsersPage);
app.post("/admin/users/add", isAuthenticated, isAdmin, adminController.createUser);
app.post("/admin/users/delete/:id", isAuthenticated, isAdmin, adminController.deleteUser);
app.get("/admin/users/edit/:id", isAuthenticated, isAdmin, adminController.showEditUserPage);
app.post("/admin/users/edit/:id", isAuthenticated, isAdmin, adminController.updateUser);

// Manage Wallets
app.get("/admin/wallet", isAuthenticated, isAdmin, adminController.showManageWalletsPage);
app.post("/admin/wallet/adjust", isAuthenticated, isAdmin, adminController.adjustWallet);
app.post("/admin/wallet/permissions", isAuthenticated, isAdmin, adminController.updateWalletPermissions);

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
