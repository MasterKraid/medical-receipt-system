import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { db } from './database';
import { User, Lab, Receipt, Estimate, Customer, Branch, PackageList, FormattedCustomer, Document, Transaction, Package, LabReport } from './types';

const router = Router();

// --- UTILITIES & MIDDLEWARE ---

const getISTDateTimeString = (): string => {
    const now = new Date();
    const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const day = String(istDate.getDate()).padStart(2, '0');
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const year = istDate.getFullYear();
    const hours = String(istDate.getHours()).padStart(2, '0');
    const minutes = String(istDate.getMinutes()).padStart(2, '0');
    const seconds = String(istDate.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} | ${hours}:${minutes}:${seconds} | UTC+5:30`;
};

const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if ((req.session as any).user) {
        next();
    } else {
        res.status(401).json({ message: "Unauthorized: Please log in." });
    }
};

const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    const user = (req.session as any).user as User;
    if (user && user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ message: "Forbidden: Administrator access required." });
    }
}

// --- FILE UPLOAD CONFIG (MULTER) ---
const uploadDir = path.join(__dirname, '..', 'public', 'lab_reports');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `report-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only PDF files are allowed'));
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const excelUpload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.originalname.match(/\.(xlsx|xls)$/)) cb(null, true);
        else cb(new Error('Only Excel files are allowed'));
    },
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for excel
});

// --- AUTH ROUTES ---

router.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    try {
        const userRow = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User & { password_hash: string };
        if (userRow && bcrypt.compareSync(password, userRow.password_hash)) {
            const { password_hash, ...user } = userRow;
            const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(user.branchId) as Branch;
            const assigned_list_ids = db.prepare('SELECT package_list_id FROM user_package_list_access WHERE user_id = ?').all(user.id).map((row: any) => row.package_list_id);
            const userSessionData = { ...user, assigned_list_ids };
            (req.session as any).user = userSessionData;
            res.json({ user: userSessionData, branch });
        } else {
            res.status(401).json({ message: 'Invalid username or password' });
        }
    } catch (error: any) {
        res.status(500).json({ message: 'Server error during login: ' + error.message });
    }
});

router.get('/auth/me', isAuthenticated, (req, res) => {
    const sessionUser = (req.session as any).user as User;
    try {
        const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(sessionUser.id) as User & { password_hash: string };
        if (userRow) {
            const { password_hash, ...user } = userRow;
            const assigned_list_ids = db.prepare('SELECT package_list_id FROM user_package_list_access WHERE user_id = ?').all(user.id).map((row: any) => row.package_list_id);
            const userSessionData = { ...user, assigned_list_ids };

            // Update session with fresh data
            (req.session as any).user = userSessionData;

            const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(user.branchId) as Branch;
            res.json({ user: userSessionData, branch });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
});

// --- DOCUMENT CREATION ---

const handleCustomerData = (customer_data: any, user_id: number): number => {
    // SCENARIO 1: An existing customer was selected from the search.
    // We have an ID and should ONLY update this customer.
    if (customer_data.id) {
        db.prepare(`UPDATE customers SET prefix = ?, name = ?, mobile = ?, email = ?, dob = ?, age = ?, age_years = ?, age_months = ?, age_days = ?, gender = ?, updated_at = ? WHERE id = ?`)
            .run(
                customer_data.prefix, 
                customer_data.name, 
                customer_data.mobile, 
                customer_data.email, 
                customer_data.dob, 
                customer_data.age ? parseInt(customer_data.age, 10) : null, 
                customer_data.age_years !== '' && customer_data.age_years !== undefined ? parseInt(customer_data.age_years, 10) : null,
                customer_data.age_months !== '' && customer_data.age_months !== undefined ? parseInt(customer_data.age_months, 10) : null,
                customer_data.age_days !== '' && customer_data.age_days !== undefined ? parseInt(customer_data.age_days, 10) : null,
                customer_data.gender, 
                getISTDateTimeString(), 
                customer_data.id
            );
        return customer_data.id;
    }

    // SCENARIO 3: The mobile number is unique, so we can safely create a new customer.
    const now = getISTDateTimeString();
    const result = db.prepare(`INSERT INTO customers (prefix, name, mobile, email, dob, age, age_years, age_months, age_days, gender, created_at, updated_at, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
            customer_data.prefix, 
            customer_data.name, 
            customer_data.mobile, 
            customer_data.email, 
            customer_data.dob, 
            customer_data.age ? parseInt(customer_data.age, 10) : null, 
            customer_data.age_years !== '' && customer_data.age_years !== undefined ? parseInt(customer_data.age_years, 10) : null,
            customer_data.age_months !== '' && customer_data.age_months !== undefined ? parseInt(customer_data.age_months, 10) : null,
            customer_data.age_days !== '' && customer_data.age_days !== undefined ? parseInt(customer_data.age_days, 10) : null,
            customer_data.gender, 
            now, 
            now, 
            user_id
        );
    return result.lastInsertRowid as number;
};

router.post('/receipts', isAuthenticated, (req, res) => {
    const user = (req.session as any).user as User;
    const { branch, acting_as_client_id } = req.body.context || {};
    const payload = req.body.payload;

    try {
        const transaction = db.transaction(() => {
            const customerId = handleCustomerData(payload.customer_data, user.id);
            const customerName = db.prepare('SELECT name FROM customers WHERE id = ?').get(customerId) as { name: string };
            const lab = db.prepare('SELECT logo_path FROM labs WHERE id = ?').get(payload.lab_id) as Lab;

            const receiptResult = db.prepare(`INSERT INTO receipts (customer_id, branch_id, created_at, total_mrp, amount_final, amount_received, amount_due, payment_method, referred_by, notes, num_tests, logo_path, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(customerId, branch.id, getISTDateTimeString(), payload.total_mrp, payload.amount_final, payload.amount_received, payload.amount_due, payload.payment_method, payload.referred_by, payload.notes, payload.num_tests || payload.items.length, lab?.logo_path, user.id);
            const newReceiptId = receiptResult.lastInsertRowid;

            const insertItem = db.prepare('INSERT INTO receipt_items (receipt_id, package_name, mrp, discount_percentage) VALUES (?, ?, ?, ?)');
            payload.items.forEach((item: any) => insertItem.run(newReceiptId, item.name, item.mrp, item.discount));

            let updatedUser: User | null = null;

            // Determine the true client ID and whether wallet logic applies
            let targetClientId = -1;
            let shouldDeductWallet = false;

            if (user.role === 'CLIENT') {
                targetClientId = user.id;
                shouldDeductWallet = true;
            } else if (acting_as_client_id && (user.role === 'ADMIN' || user.master_data_entry)) {
                targetClientId = acting_as_client_id;
                shouldDeductWallet = true;
            }

            if (shouldDeductWallet && targetClientId !== -1) {
                const totalB2BCost = payload.items.reduce((sum: number, item: any) => sum + (Number(item.b2b_price) || 0), 0);

                if (totalB2BCost > 0) {
                    // Check if they have enough balance (or allow negative)
                    const targetClient = db.prepare('SELECT wallet_balance, allow_negative_balance, negative_balance_allowed_until FROM users WHERE id = ?').get(targetClientId) as User;
                    if (!targetClient) throw new Error("Target client not found.");

                    let canProceed = false;
                    if (targetClient.wallet_balance >= totalB2BCost) {
                        canProceed = true;
                    } else if (targetClient.allow_negative_balance) {
                        if (targetClient.negative_balance_allowed_until) {
                            const untilDate = new Date(targetClient.negative_balance_allowed_until);
                            if (untilDate >= new Date()) canProceed = true;
                        } else {
                            canProceed = true;
                        }
                    }

                    if (!canProceed) {
                        throw new Error(`Insufficient wallet balance for client (Current: ₹${targetClient.wallet_balance.toFixed(2)}, Required: ₹${totalB2BCost.toFixed(2)})`);
                    }

                    // 1. Update user's wallet balance in the database
                    db.prepare('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?').run(totalB2BCost, targetClientId);

                    // 1.5 Fetch new balance for snapshot
                    const newBalanceObj = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(targetClientId) as { wallet_balance: number };

                    // 2. Create a detailed transaction record for the history
                    db.prepare('INSERT INTO transactions (user_id, date, type, amount_deducted, balance_snapshot, receipt_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
                        .run(targetClientId, getISTDateTimeString(), 'RECEIPT_DEDUCTION', totalB2BCost, newBalanceObj.wallet_balance, newReceiptId, `Payment for ${customerName.name}`);
                }

                // If acting as self, return updated user data to refresh UI
                if (targetClientId === user.id) {
                    const updatedUserRow = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as User & { password_hash: string };
                    const { password_hash, ...rest } = updatedUserRow;
                    updatedUser = rest;
                }
            }

            const newReceipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(newReceiptId) as Receipt;
            return { newReceipt, updatedUser };
        });

        const result = transaction();
        res.status(201).json(result);
    } catch (e: any) {
        // Send back a specific error message if it's the one we threw
        res.status(e.message.includes("already exists") ? 409 : 500).json({ message: e.message });
    }
});

router.post('/estimates', isAuthenticated, (req, res) => {
    const user = (req.session as any).user as User;
    const { branch } = req.body.context;
    const payload = req.body.payload;
    try {
        const transaction = db.transaction(() => {
            const customerId = handleCustomerData(payload.customer_data, user.id);
            const estimateResult = db.prepare(`INSERT INTO estimates (customer_id, branch_id, created_at, amount_after_discount, referred_by, notes, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`)
                .run(customerId, branch.id, getISTDateTimeString(), payload.amount_after_discount, payload.referred_by, payload.notes, user.id);
            const newEstimateId = estimateResult.lastInsertRowid;

            const insertItem = db.prepare('INSERT INTO estimate_items (estimate_id, package_name, mrp, discount_percentage) VALUES (?, ?, ?, ?)');
            payload.items.forEach((item: any) => insertItem.run(newEstimateId, item.name, item.mrp, item.discount));

            return db.prepare('SELECT * FROM estimates WHERE id = ?').get(newEstimateId) as Estimate;
        });
        res.status(201).json(transaction());
    } catch (e: any) { res.status(500).json({ message: `Estimate creation failed: ${e.message}` }); }
});

// --- GENERAL GET ROUTES ---

router.get('/receipts/:id', isAuthenticated, (req, res) => {
    try {
        const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(req.params.id) as Receipt;
        if (!receipt) return res.status(404).json({ message: "Receipt not found" });
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(receipt.customer_id) as Customer;
        const items = db.prepare('SELECT id, package_name, mrp, discount_percentage FROM receipt_items WHERE receipt_id = ?').all(req.params.id);
        const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(receipt.branch_id) as Branch;
        res.json({ receipt, customer, items, branch });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get('/estimates/:id', isAuthenticated, (req, res) => {
    try {
        const estimate = db.prepare('SELECT * FROM estimates WHERE id = ?').get(req.params.id) as Estimate;
        if (!estimate) return res.status(404).json({ message: "Estimate not found" });
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(estimate.customer_id) as Customer;
        const items = db.prepare('SELECT id, package_name, mrp, discount_percentage FROM estimate_items WHERE estimate_id = ?').all(req.params.id);
        const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(estimate.branch_id) as Branch;
        res.json({ estimate, customer, items, branch });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get('/customers/search', isAuthenticated, (req, res) => {
    const q = req.query.q as string;
    try {
        const searchTerm = `%${q}%`;
        const idSearch = `CUST-${'0'.repeat(10 - q.length)}${q}`;
        res.json(db.prepare(`SELECT * FROM customers WHERE name LIKE ? OR mobile LIKE ? OR 'CUST-' || printf('%010d', id) LIKE ? LIMIT 10`).all(searchTerm, searchTerm, idSearch));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get('/package-lists/for-lab/:labId', isAuthenticated, (req, res) => {
    const user = (req.session as any).user as User;
    const actingAsId = req.headers['x-acting-as-client-id'];
    const effectiveUserId = (actingAsId && (user.role === 'ADMIN' || user.master_data_entry)) ? parseInt(actingAsId as string) : user.id;
    const isActuallyActingAs = !!(actingAsId && (user.role === 'ADMIN' || user.master_data_entry));

    try {
        const query = (user.role === 'ADMIN' && !isActuallyActingAs)
            ? `SELECT pl.* FROM package_lists pl JOIN lab_package_lists lpl ON pl.id = lpl.package_list_id WHERE lpl.lab_id = ?`
            : `SELECT pl.* FROM package_lists pl JOIN lab_package_lists lpl ON pl.id = lpl.package_list_id JOIN user_package_list_access ula ON pl.id = ula.package_list_id WHERE lpl.lab_id = ? AND ula.user_id = ?`;
        const params = (user.role === 'ADMIN' && !isActuallyActingAs) ? [req.params.labId] : [req.params.labId, effectiveUserId];
        res.json(db.prepare(query).all(params));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get('/packages/for-list/:listId', isAuthenticated, (req, res) => {
    try {
        res.json(db.prepare('SELECT * FROM packages WHERE package_list_id = ? ORDER BY name ASC').all(req.params.listId));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get('/transactions', isAuthenticated, (req, res) => {
    const user = (req.session as any).user as User;
    if (user.role !== 'CLIENT') return res.status(403).json({ message: "Forbidden" });
    try {
        const txs = db.prepare(`SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC`).all(user.id) as Transaction[];
        const enrichedTxs = txs.map(tx => {
            if (tx.type === 'RECEIPT_DEDUCTION' && tx.receipt_id) {
                const receipt = db.prepare(`SELECT r.customer_id, c.name as customer_name FROM receipts r JOIN customers c ON c.id = r.customer_id WHERE r.id = ?`).get(tx.receipt_id) as any;
                const items = db.prepare(`SELECT package_name, mrp FROM receipt_items WHERE receipt_id = ?`).all(tx.receipt_id) as any[];
                const b2bListId = user.assigned_list_ids?.[0];
                let total_profit = 0;
                const itemsWithB2B = items.map(item => {
                    const pkg = db.prepare(`SELECT b2b_price FROM packages WHERE package_list_id = ? AND name = ?`).get(b2bListId, item.package_name) as Package;
                    const b2b_price = pkg?.b2b_price || item.mrp;
                    total_profit += item.mrp - b2b_price;
                    return { name: item.package_name, mrp: item.mrp, b2b_price };
                });
                return { ...tx, items: itemsWithB2B, customer_name: receipt?.customer_name, total_profit };
            }
            return tx;
        });
        res.json(enrichedTxs);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// --- ADMIN-ONLY ROUTES ---

router.get('/users', isAdmin, (req, res) => res.json(db.prepare('SELECT id, username, alias, branchId, role, master_data_entry FROM users').all()));
router.get('/branches', isAdmin, (req, res) => res.json(db.prepare('SELECT * FROM branches').all()));
router.get('/labs', isAuthenticated, (req, res) => {
    const user = (req.session as any).user as User;
    let labs: Lab[];
    const actingAsId = req.headers['x-acting-as-client-id'];
    const effectiveUserId = (actingAsId && (user.role === 'ADMIN' || user.master_data_entry)) ? parseInt(actingAsId as string) : user.id;
    const isActuallyActingAs = !!(actingAsId && (user.role === 'ADMIN' || user.master_data_entry));

    try {
        if (user.role === 'ADMIN' && !isActuallyActingAs) {
            labs = db.prepare('SELECT * FROM labs').all() as Lab[];
        } else {
            labs = db.prepare(`
                SELECT DISTINCT l.* 
                FROM labs l 
                JOIN lab_package_lists lpl ON l.id = lpl.lab_id 
                JOIN user_package_list_access upla ON lpl.package_list_id = upla.package_list_id 
                WHERE upla.user_id = ?
            `).all(effectiveUserId) as Lab[];
        }

        labs.forEach(lab => {
            lab.assigned_list_ids = db.prepare('SELECT package_list_id from lab_package_lists WHERE lab_id = ?').all(lab.id).map((r: any) => r.package_list_id);
        });
        res.json(labs);
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
});
router.get('/package-lists', isAdmin, (req, res) => res.json(db.prepare('SELECT p.*, (SELECT COUNT(*) FROM packages WHERE package_list_id = p.id) as package_count FROM package_lists p').all()));
router.get('/client-wallets', isAuthenticated, (req, res) => {
    const user = (req.session as any).user as User;
    if (user.role !== 'ADMIN' && !user.master_data_entry) {
        return res.status(403).json({ message: "Forbidden: Master Data Entry access required." });
    }
    const query = req.query.q as string;
    let clients;
    if (query) {
        const searchTerm = `%${query}%`;
        clients = db.prepare("SELECT * FROM users WHERE role = 'CLIENT' AND (username LIKE ? OR alias LIKE ?)").all(searchTerm, searchTerm);
    } else {
        clients = db.prepare("SELECT * FROM users WHERE role = 'CLIENT'").all();
    }
    res.json(clients);
});

// --- ADMIN GET ROUTES (continued) ---

router.get('/customers', isAuthenticated, (req, res) => {
    const user = (req.session as any).user as User;
    try {
        const query = user.role === 'ADMIN'
            ? `SELECT * FROM customers ORDER BY id DESC`
            : `SELECT * FROM customers WHERE created_by_user_id = ? ORDER BY id DESC`;
        const params = user.role === 'ADMIN' ? [] : [user.id];
        const customers = db.prepare(query).all(...params) as Customer[];
        const formattedCustomers: FormattedCustomer[] = customers.map((c: Customer) => ({
            ...c,
            display_id: `CUST-${String(c.id).padStart(10, '0')}`,
            dob_formatted: c.dob ? new Date(c.dob).toLocaleDateString('en-GB') : 'N/A',
            display_age: c.age_years !== null ? `${c.age_years}Y ${c.age_months || '0'}M ${c.age_days || '0'}D` : (c.age ? `${c.age} yrs` : 'N/A'),
            display_created_at: c.created_at.split(' | ')[0]
        }));
        res.json(formattedCustomers);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get('/admin/receipts', isAdmin, (req, res) => {
    try {
        const receipts = db.prepare(`
            SELECT r.id, r.created_at, c.name as customer_name, c.id as customer_id, c.prefix, r.amount_final, u.alias as user_alias, u.username as username
            FROM receipts r JOIN customers c ON r.customer_id = c.id JOIN users u ON r.created_by_user_id = u.id ORDER BY r.id DESC
        `).all() as any[];
        const formatted: Document[] = receipts.map(r => ({
            id: r.id,
            display_doc_id: `RCPT-${String(r.id).padStart(6, '0')}`,
            display_date: `${r.created_at.split(' | ')[0]} ${r.created_at.split(' | ')[1]}`,
            customer_name: `${r.prefix || ''} ${r.customer_name}`,
            display_customer_id: `CUST-${String(r.customer_id).padStart(10, '0')}`,
            display_amount: `₹${r.amount_final.toFixed(2)}`,
            created_by_user: r.user_alias || r.username
        }));
        res.json(formatted);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get('/admin/estimates', isAdmin, (req, res) => {
    try {
        const estimates = db.prepare(`
            SELECT e.id, e.created_at, c.name as customer_name, c.id as customer_id, c.prefix, e.amount_after_discount, u.alias as user_alias, u.username as username
            FROM estimates e JOIN customers c ON e.customer_id = c.id JOIN users u ON e.created_by_user_id = u.id ORDER BY e.id DESC
        `).all() as any[];
        const formatted: Document[] = estimates.map(e => ({
            id: e.id,
            display_doc_id: `EST-${String(e.id).padStart(6, '0')}`,
            display_date: `${e.created_at.split(' | ')[0]} ${e.created_at.split(' | ')[1]}`,
            customer_name: `${e.prefix || ''} ${e.customer_name}`,
            display_customer_id: `CUST-${String(e.customer_id).padStart(10, '0')}`,
            display_amount: `₹${e.amount_after_discount.toFixed(2)}`,
            created_by_user: e.user_alias || e.username
        }));
        res.json(formatted);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// --- ADMIN C-UD (CREATE, UPDATE, DELETE) ROUTES ---

// Users Management
router.get('/users/:id', isAdmin, (req, res) => {
    try {
        const user = db.prepare('SELECT id, username, alias, branchId, role, master_data_entry FROM users WHERE id = ?').get(req.params.id) as User;
        if (user) {
            user.assigned_list_ids = db.prepare('SELECT package_list_id FROM user_package_list_access WHERE user_id = ?').all(req.params.id).map((r: any) => r.package_list_id);
        }
        res.json(user);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post('/users', isAdmin, (req, res) => {
    const { username, alias, password_hash, branchId, role, assigned_list_ids, master_data_entry } = req.body;
    const password = bcrypt.hashSync(password_hash, 10);
    const transaction = db.transaction(() => {
        const result = db.prepare('INSERT INTO users (username, alias, password_hash, branchId, role, master_data_entry) VALUES (?, ?, ?, ?, ?, ?)').run(username, alias, password, branchId, role, master_data_entry ? 1 : 0);
        const userId = result.lastInsertRowid;
        const insertAccess = db.prepare('INSERT INTO user_package_list_access (user_id, package_list_id) VALUES (?, ?)');
        assigned_list_ids.forEach((listId: number) => insertAccess.run(userId, listId));
    });
    try {
        transaction();
        res.status(201).json({ message: 'User created successfully' });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.put('/users/:id', isAdmin, (req, res) => {
    const { username, alias, password_hash, branchId, role, assigned_list_ids, master_data_entry } = req.body;
    const transaction = db.transaction(() => {
        if (password_hash) {
            const password = bcrypt.hashSync(password_hash, 10);
            db.prepare('UPDATE users SET username=?, alias=?, password_hash=?, branchId=?, role=?, master_data_entry=? WHERE id=?').run(username, alias, password, branchId, role, master_data_entry ? 1 : 0, req.params.id);
        } else {
            db.prepare('UPDATE users SET username=?, alias=?, branchId=?, role=?, master_data_entry=? WHERE id=?').run(username, alias, branchId, role, master_data_entry ? 1 : 0, req.params.id);
        }
        db.prepare('DELETE FROM user_package_list_access WHERE user_id = ?').run(req.params.id);
        const insertAccess = db.prepare('INSERT INTO user_package_list_access (user_id, package_list_id) VALUES (?, ?)');
        (assigned_list_ids || []).forEach((listId: number) => insertAccess.run(req.params.id, listId));
    });
    try {
        transaction();
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete('/users/:id', isAdmin, (req, res) => {
    try {
        // Prevent self-deletion
        if ((req.session as any).user.id == req.params.id) {
            return res.status(400).json({ message: "You cannot delete your own account." });
        }
        db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// Branch Management
router.post('/branches', isAdmin, (req, res) => {
    const { name, address, phone } = req.body;
    try {
        db.prepare('INSERT INTO branches (name, address, phone) VALUES (?, ?, ?)').run(name, address, phone);
        res.status(201).json({ message: 'Branch created' });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.put('/branches/:id', isAdmin, (req, res) => {
    const { name, address, phone } = req.body;
    try {
        db.prepare('UPDATE branches SET name=?, address=?, phone=? WHERE id=?').run(name, address, phone, req.params.id);
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// Lab Management
router.post('/labs', isAdmin, (req, res) => {
    try {
        db.prepare('INSERT INTO labs (name) VALUES (?)').run(req.body.name);
        res.status(201).json({ message: 'Lab created' });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete('/labs/:id', isAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM labs WHERE id = ?').run(req.params.id);
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.put('/labs/:id/lists', isAdmin, (req, res) => {
    const labId = req.params.id;
    const listIds = req.body.listIds as number[];
    const transaction = db.transaction(() => {
        db.prepare('DELETE FROM lab_package_lists WHERE lab_id = ?').run(labId);
        const insert = db.prepare('INSERT INTO lab_package_lists (lab_id, package_list_id) VALUES (?, ?)');
        listIds.forEach(listId => insert.run(labId, listId));
    });
    try {
        transaction();
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.put('/labs/:id/logo', isAdmin, (req, res) => {
    const labId = req.params.id;
    const { logoBase64 } = req.body;

    if (!logoBase64) return res.status(400).json({ message: "Logo data is required" });

    try {
        // Extract base64 content
        const matches = logoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ message: "Invalid base64 string" });
        }

        const extension = matches[1].split('/')[1] === 'jpeg' ? 'jpg' : matches[1].split('/')[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `lab_${labId}_${Date.now()}.${extension}`;
        const relativePath = `/lab_logos/${fileName}`;
        const absolutePath = path.join(__dirname, '..', 'public', 'lab_logos', fileName);

        // Ensure directory exists
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(absolutePath, buffer);

        // Update database
        db.prepare('UPDATE labs SET logo_path = ? WHERE id = ?').run(relativePath, labId);

        res.json({ logoPath: relativePath });
    } catch (error: any) {
        console.error("Upload failed:", error);
        res.status(500).json({ message: "Failed to upload logo: " + error.message });
    }
});

// Package List & Package Management
router.post('/package-lists', isAdmin, (req, res) => {
    try {
        db.prepare('INSERT INTO package_lists (name) VALUES (?)').run(req.body.name);
        res.status(201).json({ message: 'List created' });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete('/package-lists/:id', isAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM package_lists WHERE id = ?').run(req.params.id);
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post('/package-lists/:id/upload', isAdmin, (req, res) => {
    const listId = req.params.id;
    const packages = req.body.packages as any[];
    const transaction = db.transaction(() => {
        let inserted = 0, updated = 0;
        const selectPkg = db.prepare('SELECT id FROM packages WHERE package_list_id = ? AND name = ?');
        const updatePkg = db.prepare('UPDATE packages SET mrp = ?, b2b_price = ? WHERE id = ?');
        const insertPkg = db.prepare('INSERT INTO packages (name, mrp, b2b_price, package_list_id) VALUES (?, ?, ?, ?)');
        packages.forEach(pkg => {
            const existing = selectPkg.get(listId, pkg.name) as Package;
            if (existing) {
                updatePkg.run(pkg.mrp, pkg.b2b_price, existing.id);
                updated++;
            } else {
                insertPkg.run(pkg.name, pkg.mrp, pkg.b2b_price, listId);
                inserted++;
            }
        });
        return { inserted, updated };
    });
    try {
        res.json(transaction());
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post('/packages', isAdmin, (req, res) => {
    const { name, mrp, b2b_price, package_list_id } = req.body;
    try {
        const result = db.prepare('INSERT INTO packages (name, mrp, b2b_price, package_list_id) VALUES (?, ?, ?, ?)').run(name, mrp, b2b_price, package_list_id);
        res.status(201).json({ id: result.lastInsertRowid, ...req.body });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.put('/packages/:id', isAdmin, (req, res) => {
    const { name, mrp, b2b_price } = req.body;
    try {
        db.prepare('UPDATE packages SET name = ?, mrp = ?, b2b_price = ? WHERE id = ?').run(name, mrp, b2b_price, req.params.id);
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// Wallet Management
router.put('/wallets/update', isAdmin, (req, res) => {
    const { clientId, action, amount, notes } = req.body;
    const transaction = db.transaction(() => {
        const client = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(clientId) as User;
        if (!client) throw new Error("Client not found");
        let amountChange = 0;
        let type: Transaction['type'] = 'ADMIN_CREDIT';
        if (action === 'add') {
            amountChange = Number(amount);
            type = 'ADMIN_CREDIT';
        } else if (action === 'deduct') {
            amountChange = -Number(amount);
            type = 'ADMIN_DEBIT';
        } else if (action === 'settle') {
            amountChange = -client.wallet_balance;
            type = 'SETTLEMENT';
        }
        db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(amountChange, clientId);

        const newBalanceObj = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(clientId) as { wallet_balance: number };

        db.prepare('INSERT INTO transactions (user_id, date, type, amount_deducted, balance_snapshot, notes) VALUES (?, ?, ?, ?, ?, ?)')
            .run(clientId, getISTDateTimeString(), type, -amountChange, newBalanceObj.wallet_balance, notes);
    });
    try {
        transaction();
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.put('/wallets/permissions', isAdmin, (req, res) => {
    const { clientId, allow, until } = req.body;
    try {
        db.prepare('UPDATE users SET allow_negative_balance = ?, negative_balance_allowed_until = ? WHERE id = ?').run(allow ? 1 : 0, allow ? until : null, clientId);
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// Customer Management
router.get('/customers/:id', isAdmin, (req, res) => {
    try {
        res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.put('/customers/:id', isAdmin, (req, res) => {
    const { prefix, name, mobile, email, dob, age, age_years, age_months, age_days, gender } = req.body;
    try {
        db.prepare('UPDATE customers SET prefix=?, name=?, mobile=?, email=?, dob=?, age=?, age_years=?, age_months=?, age_days=?, gender=?, updated_at=? WHERE id=?')
            .run(prefix, name, mobile, email, dob, age, age_years, age_months, age_days, gender, getISTDateTimeString(), req.params.id);
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// --- TRANSACTION & DOCUMENT MANAGEMENT (ADMIN ONLY) ---

router.delete('/admin/transactions/:id/revert', isAdmin, (req, res) => {
    try {
        const transactionResult = db.transaction(() => {
            const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id) as Transaction;
            if (!tx) throw new Error("Transaction not found");

            // 1. If it's a receipt deduction, delete the receipt and its items
            if (tx.type === 'RECEIPT_DEDUCTION' && tx.receipt_id) {
                db.prepare('DELETE FROM receipts WHERE id = ?').run(tx.receipt_id);
                // Note: receipt_items are deleted via CASCADE from receipts
            }

            // 2. Revert wallet balance (Refund/Deduct the original amount)
            // tx.amount_deducted is positive for deductions, negative for credits.
            // To revert: current_balance = current_balance + amount_deducted
            db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(tx.amount_deducted, tx.user_id);

            // 3. Delete the transaction record
            db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
        });
        transactionResult();
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete('/admin/transactions/:id/delete', isAdmin, (req, res) => {
    try {
        const transactionResult = db.transaction(() => {
            const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id) as Transaction;
            if (!tx) throw new Error("Transaction not found");

            // 1. Revert wallet balance
            db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(tx.amount_deducted, tx.user_id);

            // 2. Delete transaction record (Keep the receipt!)
            db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
        });
        transactionResult();
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete('/admin/receipts/:id', isAdmin, (req, res) => {
    try {
        // Simple delete - only remove receipt entry
        db.prepare('DELETE FROM receipts WHERE id = ?').run(req.params.id);
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete('/admin/receipts/:id/revert', isAdmin, (req, res) => {
    try {
        const transactionResult = db.transaction(() => {
            // 1. Find the associated transaction
            const tx = db.prepare('SELECT * FROM transactions WHERE receipt_id = ?').get(req.params.id) as Transaction;
            if (tx) {
                // 2. Refund/Deduct the wallet balance
                db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(tx.amount_deducted, tx.user_id);
                // 3. Delete transaction record
                db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
            }
            // 4. Delete receipt entry
            db.prepare('DELETE FROM receipts WHERE id = ?').run(req.params.id);
        });
        transactionResult();
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete('/admin/customers/:id', isAdmin, (req, res) => {
    try {
        const customerId = req.params.id;
        const transactionResult = db.transaction(() => {
            // 1. Delete all receipt items associated with customer receipts
            db.prepare(`
                DELETE FROM receipt_items 
                WHERE receipt_id IN (SELECT id FROM receipts WHERE customer_id = ?)
            `).run(customerId);

            // 2. Delete all receipts for the customer
            db.prepare('DELETE FROM receipts WHERE customer_id = ?').run(customerId);

            // 3. Delete all estimate items associated with customer estimates
            db.prepare(`
                DELETE FROM estimate_items 
                WHERE estimate_id IN (SELECT id FROM estimates WHERE customer_id = ?)
            `).run(customerId);

            // 4. Delete all estimates for the customer
            db.prepare('DELETE FROM estimates WHERE customer_id = ?').run(customerId);

            // 5. Delete the customer
            db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
        });
        transactionResult();
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get('/admin/transactions/user/:userId', isAdmin, (req, res) => {
    try {
        const txs = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC').all(req.params.userId) as Transaction[];
        res.json(txs);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// --- LAB REPORTS ENDPOINTS ---

router.post('/reports/upload', isAdmin, upload.single('report'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No PDF file uploaded.' });
    }
    const { client_id, customer_name } = req.body;
    if (!client_id || !customer_name) {
        fs.unlinkSync(req.file.path); // Cleanup
        return res.status(400).json({ message: 'Missing client_id or customer_name.' });
    }

    try {
        const relativePath = `/lab_reports/${req.file.filename}`;
        const result = db.prepare(`INSERT INTO lab_reports (client_id, customer_name, file_path, uploaded_at) VALUES (?, ?, ?, ?)`)
            .run(client_id, customer_name, relativePath, getISTDateTimeString());

        res.status(201).json({
            message: 'Report uploaded successfully',
            reportId: result.lastInsertRowid
        });
    } catch (e: any) {
        fs.unlinkSync(req.file.path);
        res.status(500).json({ message: e.message });
    }
});

router.get('/reports', isAdmin, (req, res) => {
    try {
        const reports = db.prepare(`
            SELECT lr.*, u.alias, u.username 
            FROM lab_reports lr 
            JOIN users u ON lr.client_id = u.id 
            ORDER BY lr.id DESC
        `).all() as any[];

        res.json(reports);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get('/reports/client', isAuthenticated, (req, res) => {
    const user = (req.session as any).user as User;
    if (user.role !== 'CLIENT') {
        return res.status(403).json({ message: 'Forbidden' });
    }
    try {
        const reports = db.prepare('SELECT * FROM lab_reports WHERE client_id = ? ORDER BY id DESC').all(user.id) as any[];
        res.json(reports);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.put('/reports/:id/read', isAuthenticated, (req, res) => {
    try {
        db.prepare('UPDATE lab_reports SET is_read = 1 WHERE id = ?').run(req.params.id);
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete('/reports/:id', isAdmin, (req, res) => {
    try {
        const report = db.prepare('SELECT file_path FROM lab_reports WHERE id = ?').get(req.params.id) as any;
        if (report) {
            const absolutePath = path.join(__dirname, '..', 'public', report.file_path);
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
            }
            db.prepare('DELETE FROM lab_reports WHERE id = ?').run(req.params.id);
        }
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// Periodic cleanup function for old reports (called occasionally or via cron in production)
export const cleanupOldReports = () => {
    try {
        // SQLite date logic: compare ISO-ish dates. We stored custom IST strings, which makes direct Date('<90 days') hard in SQL.
        // It's safer to fetch all, parse in JS, and delete.
        const reports = db.prepare('SELECT id, file_path, uploaded_at FROM lab_reports').all() as any[];
        const now = new Date();
        const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;

        let deletedCount = 0;
        reports.forEach(report => {
            // "uploaded_at" format is "DD/MM/YYYY | HH:MM:SS | UTC+5:30"
            // We need to parse it roughly to JS Date to check age
            const [datePart] = report.uploaded_at.split(' |');
            const [day, month, year] = datePart.split('/');
            const uploadDate = new Date(`${year}-${month}-${day}`);

            if (!isNaN(uploadDate.getTime()) && (now.getTime() - uploadDate.getTime() > ninetyDaysInMs)) {
                // Delete file and record
                const absolutePath = path.join(__dirname, '..', 'public', report.file_path);
                if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
                db.prepare('DELETE FROM lab_reports WHERE id = ?').run(report.id);
                deletedCount++;
            }
        });
        if (deletedCount > 0) console.log(`Cleaned up ${deletedCount} old lab reports.`);
    } catch (error) {
        console.error("Error cleaning up old reports:", error);
    }
};

// Immediately run cleanup once on startup, then every 24 hours
cleanupOldReports();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
setInterval(cleanupOldReports, ONE_DAY_MS);

// --- ESTIMATE COMPARISON ENDPOINTS ---

router.post('/comparison/upload', isAdmin, excelUpload.single('sheet'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No Excel file uploaded.' });

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.worksheets[0]; // Assuming first sheet

        if (!worksheet) throw new Error("Excel file is empty");

        const headers: { [key: number]: string } = {}; // colNumber -> lab name
        let isFirstRow = true;

        const transaction = db.transaction(() => {
            // Clear existing data. Depending on requirements, we overwrite everything.
            db.prepare('DELETE FROM comparison_prices').run();
            db.prepare('DELETE FROM comparison_tests').run();
            db.prepare('DELETE FROM comparison_labs').run();

            const insertTest = db.prepare('INSERT INTO comparison_tests (name) VALUES (?)');
            const insertLab = db.prepare('INSERT INTO comparison_labs (name) VALUES (?)');
            const insertPrice = db.prepare('INSERT INTO comparison_prices (test_id, lab_id, price) VALUES (?, ?, ?)');

            const labNameToId: { [key: string]: number } = {};

            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (isFirstRow) {
                    // Header row: Column 1 is usually Test/Package name, Col 2+ are Labs
                    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                        if (colNumber > 1) { // Skip column 1 (Test Name)
                            const labName = cell.value?.toString().trim() || `Lab ${colNumber}`;
                            headers[colNumber] = labName;

                            // Insert into labs and map
                            const result = insertLab.run(labName);
                            labNameToId[labName] = result.lastInsertRowid as number;
                        }
                    });
                    isFirstRow = false;
                } else {
                    // Data row
                    const testName = row.getCell(1).value?.toString().trim();
                    if (!testName) return; // Skip empty test names

                    const testResult = insertTest.run(testName);
                    const testId = testResult.lastInsertRowid as number;

                    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                        if (colNumber > 1 && headers[colNumber]) {
                            const priceStr = cell.value?.toString().replace(/[^0-9.]/g, '');
                            const price = parseFloat(priceStr || '0');
                            const labId = labNameToId[headers[colNumber]];

                            if (labId && !isNaN(price)) {
                                insertPrice.run(testId, labId, price);
                            }
                        }
                    });
                }
            });
        });

        transaction();

        // Cleanup file
        fs.unlinkSync(req.file.path);

        res.status(201).json({ message: 'Comparison data uploaded successfully' });
    } catch (e: any) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ message: `Upload failed: ${e.message}` });
    }
});

router.get('/comparison/data', isAuthenticated, (req, res) => {
    try {
        const tests = db.prepare('SELECT * FROM comparison_tests ORDER BY name ASC').all();
        const labs = db.prepare('SELECT * FROM comparison_labs ORDER BY id ASC').all();
        const prices = db.prepare('SELECT * FROM comparison_prices').all();

        res.json({ tests, labs, prices });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
});

router.post('/comparison/tests', isAdmin, (req, res) => {
    const { name, prices } = req.body; // prices is [{ lab_id, price }]
    if (!name || typeof name !== 'string') return res.status(400).json({ message: "Test name is required" });

    try {
        const transaction = db.transaction(() => {
            const insertTest = db.prepare('INSERT INTO comparison_tests (name) VALUES (?)');
            const testResult = insertTest.run(name);
            const newTestId = testResult.lastInsertRowid;

            if (prices && Array.isArray(prices)) {
                const insertPrice = db.prepare('INSERT INTO comparison_prices (test_id, lab_id, price) VALUES (?, ?, ?)');
                for (const p of prices) {
                    if (p.lab_id && typeof p.price === 'number') {
                        insertPrice.run(newTestId, p.lab_id, p.price);
                    }
                }
            }
            return newTestId;
        });

        const newId = transaction();
        res.status(201).json({ id: newId, message: 'Test created successfully' });
    } catch (e: any) {
        res.status(e.message.includes("UNIQUE constraint failed") ? 409 : 500).json({ message: e.message.includes("UNIQUE") ? "Test already exists" : e.message });
    }
});

router.put('/comparison/tests/:id', isAdmin, (req, res) => {
    const testId = req.params.id;
    const { name, prices } = req.body;
    
    if (!name || typeof name !== 'string') return res.status(400).json({ message: "Test name is required" });

    try {
        const transaction = db.transaction(() => {
            // Update name
            db.prepare('UPDATE comparison_tests SET name = ? WHERE id = ?').run(name, testId);

            // Update prices by clearing existing and inserting new
            if (prices && Array.isArray(prices)) {
                db.prepare('DELETE FROM comparison_prices WHERE test_id = ?').run(testId);
                const insertPrice = db.prepare('INSERT INTO comparison_prices (test_id, lab_id, price) VALUES (?, ?, ?)');
                for (const p of prices) {
                    if (p.lab_id && typeof p.price === 'number') {
                        insertPrice.run(testId, p.lab_id, p.price);
                    }
                }
            }
        });
        transaction();
        res.json({ message: 'Test updated successfully' });
    } catch (e: any) {
        res.status(e.message.includes("UNIQUE constraint failed") ? 409 : 500).json({ message: e.message.includes("UNIQUE") ? "Test name already exists" : e.message });
    }
});

router.delete('/comparison/tests/:id', isAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM comparison_tests WHERE id = ?').run(req.params.id); // prices cascade delete
        res.status(204).end();
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
});

router.post('/comparison/labs', isAdmin, (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ message: "Lab name is required" });

    try {
        const result = db.prepare('INSERT INTO comparison_labs (name) VALUES (?)').run(name.trim());
        res.status(201).json({ id: result.lastInsertRowid, message: 'Lab created successfully' });
    } catch (e: any) {
        res.status(e.message.includes("UNIQUE constraint failed") ? 409 : 500).json({ message: e.message.includes("UNIQUE") ? "Lab already exists" : e.message });
    }
});

router.delete('/comparison/labs/:id', isAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM comparison_labs WHERE id = ?').run(req.params.id); // prices cascade delete
        res.status(204).end();
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
});

export default router;