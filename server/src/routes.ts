import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { db } from './database';
import { User, Lab, Receipt, Estimate, Customer, Branch, PackageList, FormattedCustomer, Document, Transaction, Package } from './types';

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

// --- DOCUMENT CREATION ---

const handleCustomerData = (customer_data: any, user_id: number): number => {
    // SCENARIO 1: An existing customer was selected from the search.
    // We have an ID and should ONLY update this customer.
    if (customer_data.id) {
        db.prepare(`UPDATE customers SET prefix = ?, name = ?, mobile = ?, dob = ?, age = ?, gender = ?, updated_at = ? WHERE id = ?`)
          .run(customer_data.prefix, customer_data.name, customer_data.mobile, customer_data.dob, customer_data.age ? parseInt(customer_data.age, 10) : null, customer_data.gender, getISTDateTimeString(), customer_data.id);
        return customer_data.id;
    }

    // SCENARIO 2: This is a new customer entry (no ID provided).
    // We must check if the mobile number is already in use.
    const existingCustomer = db.prepare('SELECT id FROM customers WHERE mobile = ?').get(customer_data.mobile) as Customer | undefined;

    if (existingCustomer) {
        // PREVENT OVERWRITE: Throw an error if mobile number is already registered.
        throw new Error(`Customer with mobile number ${customer_data.mobile} already exists. Please search for them instead.`);
    }

    // SCENARIO 3: The mobile number is unique, so we can safely create a new customer.
    const now = getISTDateTimeString();
    const result = db.prepare(`INSERT INTO customers (prefix, name, mobile, dob, age, gender, created_at, updated_at, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(customer_data.prefix, customer_data.name, customer_data.mobile, customer_data.dob, customer_data.age ? parseInt(customer_data.age, 10) : null, customer_data.gender, now, now, user_id);
    return result.lastInsertRowid as number;
};

router.post('/receipts', isAuthenticated, (req, res) => {
    const user = (req.session as any).user as User;
    const { branch } = req.body.context;
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
            // CORRECTED LOGIC: Only perform wallet operations for CLIENT role
            if (user.role === 'CLIENT') {
                const totalB2BCost = payload.items.reduce((sum: number, item: any) => sum + (Number(item.b2b_price) || 0), 0);
                
                if (totalB2BCost > 0) {
                    // 1. Update user's wallet balance in the database
                    db.prepare('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?').run(totalB2BCost, user.id);
                    
                    // 2. Create a detailed transaction record for the history
                    db.prepare('INSERT INTO transactions (user_id, date, type, amount_deducted, receipt_id, notes) VALUES (?, ?, ?, ?, ?, ?)')
                      .run(user.id, getISTDateTimeString(), 'RECEIPT_DEDUCTION', totalB2BCost, newReceiptId, `Payment for ${customerName.name}`);
                }

                // 3. Fetch the user's new data to send back to the frontend
                const updatedUserRow = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as User & { password_hash: string };
                const { password_hash, ...rest } = updatedUserRow;
                updatedUser = rest;
            }

            const newReceipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(newReceiptId) as Receipt;
            return { newReceipt, updatedUser };
        });

        const result = transaction();
        res.status(201).json(result);
    } catch(e: any) { 
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
    } catch(e: any) { res.status(500).json({ message: `Estimate creation failed: ${e.message}` }); }
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
    } catch(e: any) { res.status(500).json({message: e.message}); }
});

router.get('/estimates/:id', isAuthenticated, (req, res) => {
    try {
        const estimate = db.prepare('SELECT * FROM estimates WHERE id = ?').get(req.params.id) as Estimate;
        if (!estimate) return res.status(404).json({ message: "Estimate not found" });
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(estimate.customer_id) as Customer;
        const items = db.prepare('SELECT id, package_name, mrp, discount_percentage FROM estimate_items WHERE estimate_id = ?').all(req.params.id);
        const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(estimate.branch_id) as Branch;
        res.json({ estimate, customer, items, branch });
    } catch(e: any) { res.status(500).json({message: e.message}); }
});

router.get('/customers/search', isAuthenticated, (req, res) => {
    const q = req.query.q as string;
    try {
        const searchTerm = `%${q}%`;
        const idSearch = `CUST-${'0'.repeat(10 - q.length)}${q}`;
        res.json(db.prepare(`SELECT * FROM customers WHERE name LIKE ? OR mobile LIKE ? OR 'CUST-' || printf('%010d', id) LIKE ? LIMIT 10`).all(searchTerm, searchTerm, idSearch));
    } catch(e: any) { res.status(500).json({message: e.message}); }
});

router.get('/package-lists/for-lab/:labId', isAuthenticated, (req, res) => {
    const user = (req.session as any).user as User;
    try {
        const query = user.role === 'ADMIN'
            ? `SELECT pl.* FROM package_lists pl JOIN lab_package_lists lpl ON pl.id = lpl.package_list_id WHERE lpl.lab_id = ?`
            : `SELECT pl.* FROM package_lists pl JOIN lab_package_lists lpl ON pl.id = lpl.package_list_id JOIN user_package_list_access ula ON pl.id = ula.package_list_id WHERE lpl.lab_id = ? AND ula.user_id = ?`;
        const params = user.role === 'ADMIN' ? [req.params.labId] : [req.params.labId, user.id];
        res.json(db.prepare(query).all(params));
    } catch(e: any) { res.status(500).json({message: e.message}); }
});

router.get('/packages/for-list/:listId', isAuthenticated, (req, res) => {
    try {
        res.json(db.prepare('SELECT * FROM packages WHERE package_list_id = ? ORDER BY name ASC').all(req.params.listId));
    } catch(e: any) { res.status(500).json({message: e.message}); }
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

router.get('/users', isAdmin, (req, res) => res.json(db.prepare('SELECT id, username, alias, branchId, role FROM users').all()));
router.get('/branches', isAdmin, (req, res) => res.json(db.prepare('SELECT * FROM branches').all()));
router.get('/labs', isAuthenticated, (req, res) => {
    const labs = db.prepare('SELECT * FROM labs').all() as Lab[];
    labs.forEach(lab => {
        lab.assigned_list_ids = db.prepare('SELECT package_list_id from lab_package_lists WHERE lab_id = ?').all(lab.id).map((r: any) => r.package_list_id);
    });
    res.json(labs);
});
router.get('/package-lists', isAdmin, (req, res) => res.json(db.prepare('SELECT p.*, (SELECT COUNT(*) FROM packages WHERE package_list_id = p.id) as package_count FROM package_lists p').all()));
router.get('/client-wallets', isAdmin, (req, res) => {
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
            display_age: c.age ? `${c.age} yrs` : 'N/A',
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
    } catch(e: any) { res.status(500).json({message: e.message}); }
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
    } catch(e: any) { res.status(500).json({message: e.message}); }
});

// --- ADMIN C-UD (CREATE, UPDATE, DELETE) ROUTES ---

// Users Management
router.get('/users/:id', isAdmin, (req, res) => {
    try {
        const user = db.prepare('SELECT id, username, alias, branchId, role FROM users WHERE id = ?').get(req.params.id) as User;
        if(user) {
            user.assigned_list_ids = db.prepare('SELECT package_list_id FROM user_package_list_access WHERE user_id = ?').all(req.params.id).map((r: any) => r.package_list_id);
        }
        res.json(user);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post('/users', isAdmin, (req, res) => {
    const { username, alias, password_hash, branchId, role, assigned_list_ids } = req.body;
    const password = bcrypt.hashSync(password_hash, 10);
    const transaction = db.transaction(() => {
        const result = db.prepare('INSERT INTO users (username, alias, password_hash, branchId, role) VALUES (?, ?, ?, ?, ?)').run(username, alias, password, branchId, role);
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
    const { username, alias, password_hash, branchId, role, assigned_list_ids } = req.body;
    const transaction = db.transaction(() => {
        if(password_hash){
            const password = bcrypt.hashSync(password_hash, 10);
            db.prepare('UPDATE users SET username=?, alias=?, password_hash=?, branchId=?, role=? WHERE id=?').run(username, alias, password, branchId, role, req.params.id);
        } else {
            db.prepare('UPDATE users SET username=?, alias=?, branchId=?, role=? WHERE id=?').run(username, alias, branchId, role, req.params.id);
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
            return res.status(400).json({ message: "You cannot delete your own account."});
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
    } catch(e: any) { res.status(500).json({ message: e.message }); }
});

router.put('/branches/:id', isAdmin, (req, res) => {
    const { name, address, phone } = req.body;
    try {
        db.prepare('UPDATE branches SET name=?, address=?, phone=? WHERE id=?').run(name, address, phone, req.params.id);
        res.status(204).send();
    } catch(e: any) { res.status(500).json({ message: e.message }); }
});

// Lab Management
router.post('/labs', isAdmin, (req, res) => {
    try {
        db.prepare('INSERT INTO labs (name) VALUES (?)').run(req.body.name);
        res.status(201).json({ message: 'Lab created' });
    } catch(e: any) { res.status(500).json({ message: e.message }); }
});

router.delete('/labs/:id', isAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM labs WHERE id = ?').run(req.params.id);
        res.status(204).send();
    } catch(e: any) { res.status(500).json({ message: e.message }); }
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
    } catch(e: any) { res.status(500).json({ message: e.message }); }
});

// Package List & Package Management
router.post('/package-lists', isAdmin, (req, res) => {
    try {
        db.prepare('INSERT INTO package_lists (name) VALUES (?)').run(req.body.name);
        res.status(201).json({ message: 'List created' });
    } catch(e: any) { res.status(500).json({ message: e.message }); }
});

router.delete('/package-lists/:id', isAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM package_lists WHERE id = ?').run(req.params.id);
        res.status(204).send();
    } catch(e: any) { res.status(500).json({ message: e.message }); }
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
    } catch(e: any) { res.status(500).json({ message: e.message }); }
});

router.post('/packages', isAdmin, (req, res) => {
    const { name, mrp, b2b_price, package_list_id } = req.body;
    try {
        const result = db.prepare('INSERT INTO packages (name, mrp, b2b_price, package_list_id) VALUES (?, ?, ?, ?)').run(name, mrp, b2b_price, package_list_id);
        res.status(201).json({ id: result.lastInsertRowid, ...req.body });
    } catch(e: any) { res.status(500).json({ message: e.message }); }
});

router.put('/packages/:id', isAdmin, (req, res) => {
    const { name, mrp, b2b_price } = req.body;
    try {
        db.prepare('UPDATE packages SET name = ?, mrp = ?, b2b_price = ? WHERE id = ?').run(name, mrp, b2b_price, req.params.id);
        res.status(204).send();
    } catch(e: any) { res.status(500).json({ message: e.message }); }
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
        db.prepare('INSERT INTO transactions (user_id, date, type, amount_deducted, notes) VALUES (?, ?, ?, ?, ?)').run(clientId, getISTDateTimeString(), type, -amountChange, notes);
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
    const { prefix, name, mobile, dob, age, gender } = req.body;
    try {
        db.prepare('UPDATE customers SET prefix=?, name=?, mobile=?, dob=?, age=?, gender=?, updated_at=? WHERE id=?')
            .run(prefix, name, mobile, dob, age, gender, getISTDateTimeString(), req.params.id);
        res.status(204).send();
    } catch (e: any) { res.status(500).json({ message: e.message }); }
});

export default router;