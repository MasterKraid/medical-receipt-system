import { Router } from 'express';
import { db } from '../database';
import { User, Receipt, Estimate, Customer, Branch, PackageList, Package, Transaction, Lab } from '../types';
import { isAuthenticated, getISTDateTimeString } from './shared';

const router = Router();

const handleCustomerData = (customer_data: any, user_id: number): number => {
    // SCENARIO 1: An existing customer was selected from the search.
    // We have an ID and should ONLY update this customer with new fields (do not overwrite with empty values).
    if (customer_data.id) {
        const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_data.id) as any;
        if (existing) {
            const merged = {
                prefix: customer_data.prefix !== undefined && customer_data.prefix !== '' ? customer_data.prefix : existing.prefix,
                name: customer_data.name !== undefined && customer_data.name !== '' ? customer_data.name.trim().toUpperCase() : existing.name,
                mobile: customer_data.mobile !== undefined && customer_data.mobile !== '' ? customer_data.mobile : existing.mobile,
                email: customer_data.email !== undefined && customer_data.email !== '' ? customer_data.email : existing.email,
                dob: customer_data.dob !== undefined && customer_data.dob !== '' ? customer_data.dob : existing.dob,
                age: customer_data.age !== undefined && customer_data.age !== '' ? customer_data.age : existing.age,
                age_years: customer_data.age_years !== undefined && customer_data.age_years !== '' ? customer_data.age_years : existing.age_years,
                age_months: customer_data.age_months !== undefined && customer_data.age_months !== '' ? customer_data.age_months : existing.age_months,
                age_days: customer_data.age_days !== undefined && customer_data.age_days !== '' ? customer_data.age_days : existing.age_days,
                gender: customer_data.gender !== undefined && customer_data.gender !== '' ? customer_data.gender : existing.gender,
            };
            db.prepare(`UPDATE customers SET prefix = ?, name = ?, mobile = ?, email = ?, dob = ?, age = ?, age_years = ?, age_months = ?, age_days = ?, gender = ?, updated_at = ? WHERE id = ?`)
                .run(
                    merged.prefix, 
                    merged.name, 
                    merged.mobile, 
                    merged.email, 
                    merged.dob, 
                    merged.age ? parseInt(merged.age, 10) : null, 
                    merged.age_years !== '' && merged.age_years !== null && merged.age_years !== undefined ? parseInt(merged.age_years, 10) : null,
                    merged.age_months !== '' && merged.age_months !== null && merged.age_months !== undefined ? parseInt(merged.age_months, 10) : null,
                    merged.age_days !== '' && merged.age_days !== null && merged.age_days !== undefined ? parseInt(merged.age_days, 10) : null,
                    merged.gender, 
                    getISTDateTimeString(), 
                    customer_data.id
                );
        }
        return customer_data.id;
    }

    // SCENARIO 3: The mobile number is unique, so we can safely create a new customer.
    const now = getISTDateTimeString();
    const result = db.prepare(`INSERT INTO customers (prefix, name, mobile, email, dob, age, age_years, age_months, age_days, gender, created_at, updated_at, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
            customer_data.prefix, 
            customer_data.name ? customer_data.name.trim().toUpperCase() : '', 
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
    const { payload, context } = req.body;
    const { branch, acting_as_client_id } = context || {};

    try {
        const transaction = db.transaction(() => {
            const customerId = handleCustomerData(payload.customer_data, user.id);

            const lab = db.prepare('SELECT logo_path FROM labs JOIN lab_package_lists lpl ON labs.id = lpl.lab_id WHERE lpl.package_list_id = ? LIMIT 1').get(payload.items[0].package_list_id) as Lab | undefined;

            const receiptResult = db.prepare(`INSERT INTO receipts (customer_id, branch_id, created_at, total_mrp, amount_final, amount_received, amount_due, payment_method, referred_by, notes, num_tests, logo_path, created_by_user_id, acting_as_client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(customerId, branch.id, getISTDateTimeString(), payload.total_mrp, payload.amount_final, payload.amount_received, payload.amount_due, payload.payment_method, payload.referred_by, payload.notes, payload.num_tests || payload.items.length, lab?.logo_path, user.id, acting_as_client_id || null);

            const receiptId = receiptResult.lastInsertRowid;

            const insertItem = db.prepare('INSERT INTO receipt_items (receipt_id, package_name, mrp, discount_percentage) VALUES (?, ?, ?, ?)');
            payload.items.forEach((item: any) => insertItem.run(receiptId, item.name, item.mrp, item.discount));

            let targetClientId = -1;
            if (user.role === 'CLIENT') {
                targetClientId = user.id;
            } else if (acting_as_client_id && (user.role === 'ADMIN' || user.master_data_entry)) {
                targetClientId = acting_as_client_id;
            }

            let updatedUser: User | null = null;
            if (targetClientId !== -1) {
                const totalB2BCost = payload.items.reduce((sum: number, item: any) => sum + (Number(item.b2b_price) || 0), 0);

                const client = db.prepare('SELECT wallet_balance, allow_negative_balance, negative_balance_allowed_until FROM users WHERE id = ?').get(targetClientId) as User;
                if (!client) throw new Error("Target B2B Client not found");

                let canProceed = false;
                if (client.wallet_balance >= totalB2BCost) {
                    canProceed = true;
                } else if (client.allow_negative_balance) {
                    if (client.negative_balance_allowed_until) {
                        const untilDate = new Date(client.negative_balance_allowed_until);
                        if (untilDate >= new Date()) canProceed = true;
                    } else {
                        canProceed = true;
                    }
                }

                if (!canProceed) {
                    throw new Error(`Insufficient wallet balance for B2B transaction (Required: ₹${totalB2BCost.toFixed(2)}, Available: ₹${client.wallet_balance.toFixed(2)})`);
                }

                db.prepare('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?').run(totalB2BCost, targetClientId);

                const newBalanceObj = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(targetClientId) as { wallet_balance: number };

                db.prepare('INSERT INTO transactions (user_id, date, type, amount_deducted, balance_snapshot, receipt_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
                    .run(targetClientId, getISTDateTimeString(), 'RECEIPT_DEDUCTION', totalB2BCost, newBalanceObj.wallet_balance, receiptId, `Receipt deduction for RCPT-${String(receiptId).padStart(6, '0')}`);

                if (targetClientId === user.id) {
                    updatedUser = { ...user, wallet_balance: newBalanceObj.wallet_balance };
                    (req.session as any).user = updatedUser;
                }
            }

            const newReceipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(receiptId) as Receipt;
            return { newReceipt, updatedUser };
        });

        res.status(201).json(transaction());
    } catch (e: any) {
        res.status(500).json({ message: `Receipt creation failed: ${e.message}` });
    }
});

router.post('/estimates', isAuthenticated, (req, res) => {
    const user = (req.session as any).user as User;
    const { payload, context } = req.body;
    const { branch } = context || {};

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

router.get('/receipts/:id', isAuthenticated, (req, res) => {
    try {
        const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(req.params.id) as Receipt;
        if (!receipt) return res.status(404).json({ message: "Receipt not found" });

        const user = (req.session as any).user as User;
        if (user.role === 'CLIENT') {
            if (receipt.created_by_user_id !== user.id && receipt.acting_as_client_id !== user.id) {
                return res.status(403).json({ message: "Forbidden: You do not have permission to view this receipt." });
            }
        } else if (user.role === 'GENERAL_EMPLOYEE') {
            if (receipt.branch_id !== user.branchId) {
                return res.status(403).json({ message: "Forbidden: You do not have permission to view receipts from other branches." });
            }
        }

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

        const user = (req.session as any).user as User;
        if (user.role === 'CLIENT') {
            if (estimate.created_by_user_id !== user.id) {
                return res.status(403).json({ message: "Forbidden: You do not have permission to view this estimate." });
            }
        } else if (user.role === 'GENERAL_EMPLOYEE') {
            if (estimate.branch_id !== user.branchId) {
                return res.status(403).json({ message: "Forbidden: You do not have permission to view estimates from other branches." });
            }
        }

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
        res.json(db.prepare(`SELECT * FROM customers WHERE is_deleted = 0 AND (name LIKE ? OR mobile LIKE ? OR 'CUST-' || printf('%010d', id) LIKE ?) LIMIT 10`).all(searchTerm, searchTerm, idSearch));
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

export default router;
