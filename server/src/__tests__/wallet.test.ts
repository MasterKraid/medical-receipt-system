/**
 * Wallet Ledger Integrity Tests
 * 
 * Verifies that wallet balances stay consistent with transaction ledger records,
 * that deductions/refunds are exact, and that balance constraints are enforced.
 */
import { createTestDb, seedMultiLabScenario, createReceiptWithDeduction } from './setup';

describe('Wallet Ledger Integrity', () => {
    let db: ReturnType<typeof createTestDb>;
    let ids: ReturnType<typeof seedMultiLabScenario>;

    beforeEach(() => {
        db = createTestDb();
        ids = seedMultiLabScenario(db);
    });

    afterEach(() => {
        db.close();
    });

    // =====================================================================
    // BALANCE CONSISTENCY
    // =====================================================================

    describe('Balance Consistency', () => {

        test('wallet balance after deduction equals initial balance minus B2B cost', () => {
            const initialBalance = 10000;
            const result = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [
                    { name: 'CBC', mrp: 395, discount: 0, package_list_id: ids.listAlphaId },
                    { name: 'TSH', mrp: 320, discount: 0, package_list_id: ids.listAlphaId },
                ],
            });

            const expectedCost = 150 + 100; // CBC Alpha + TSH Alpha
            expect(result.totalB2BCost).toBe(expectedCost);

            const client = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.multiLabClientId) as any;
            expect(client.wallet_balance).toBe(initialBalance - expectedCost);
        });

        test('balance_snapshot in transaction matches actual wallet balance', () => {
            createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [
                    { name: 'Glucose Fasting', mrp: 85, discount: 0, package_list_id: ids.listAlphaId },
                ],
            });

            const tx = db.prepare('SELECT balance_snapshot FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(ids.multiLabClientId) as any;
            const client = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.multiLabClientId) as any;

            expect(tx.balance_snapshot).toBe(client.wallet_balance);
        });

        test('multiple sequential receipts maintain running balance', () => {
            // Receipt 1: CBC Alpha (150)
            createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [{ name: 'CBC', mrp: 395, discount: 0, package_list_id: ids.listAlphaId }],
            });

            // Receipt 2: TSH Beta (60)
            createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [{ name: 'TSH', mrp: 350, discount: 0, package_list_id: ids.listBetaId }],
            });

            // Receipt 3: Glucose Alpha (30)
            createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [{ name: 'Glucose Fasting', mrp: 85, discount: 0, package_list_id: ids.listAlphaId }],
            });

            const client = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.multiLabClientId) as any;
            expect(client.wallet_balance).toBe(10000 - 150 - 60 - 30); // 9760

            // Verify all 3 transactions exist
            const txCount = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE user_id = ? AND type = ?').get(ids.multiLabClientId, 'RECEIPT_DEDUCTION') as any;
            expect(txCount.c).toBe(3);

            // Verify last snapshot
            const lastTx = db.prepare('SELECT balance_snapshot FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(ids.multiLabClientId) as any;
            expect(lastTx.balance_snapshot).toBe(9760);
        });

        test('transaction amount_deducted matches B2B cost exactly', () => {
            const result = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [
                    { name: 'Beta Only Test', mrp: 1000, discount: 0, package_list_id: ids.listBetaId },
                ],
            });

            const tx = db.prepare('SELECT amount_deducted FROM transactions WHERE receipt_id = ?').get(result.receiptId) as any;
            expect(tx.amount_deducted).toBe(360); // Beta Only Test b2b
            expect(tx.amount_deducted).toBe(result.totalB2BCost);
        });
    });

    // =====================================================================
    // INSUFFICIENT BALANCE ENFORCEMENT
    // =====================================================================

    describe('Insufficient Balance Enforcement', () => {

        test('receipt creation rejected when wallet balance is insufficient', () => {
            // broke_client has 50, CBC Alpha costs 150
            expect(() => {
                createReceiptWithDeduction(db, {
                    customerId: ids.customerId,
                    branchId: ids.branchId,
                    createdByUserId: ids.brokeClientId,
                    actingAsClientId: null,
                    items: [{ name: 'CBC', mrp: 395, discount: 0, package_list_id: ids.listAlphaId }],
                });
            }).toThrow("Insufficient wallet balance");

            // Wallet should remain untouched
            const client = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.brokeClientId) as any;
            expect(client.wallet_balance).toBe(50);

            // No transaction should be created
            const txCount = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE user_id = ?').get(ids.brokeClientId) as any;
            expect(txCount.c).toBe(0);

            // No receipt should be created (transaction should have rolled back)
            // Note: Our helper doesn't wrap in a DB transaction, but the server does.
            // This tests the throwing behavior.
        });

        test('negative balance allowed client can proceed past zero', () => {
            // negative_allowed_client has 50 with allow_negative_balance = true
            const result = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.negativeAllowedClientId,
                actingAsClientId: null,
                items: [{ name: 'CBC', mrp: 395, discount: 0, package_list_id: ids.listAlphaId }],
            });

            expect(result.totalB2BCost).toBe(150);

            const client = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.negativeAllowedClientId) as any;
            expect(client.wallet_balance).toBe(50 - 150); // -100
        });

        test('small-value receipt within balance proceeds normally', () => {
            // broke_client has 50, Glucose Fasting Alpha costs 30
            const result = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.brokeClientId,
                actingAsClientId: null,
                items: [{ name: 'Glucose Fasting', mrp: 85, discount: 0, package_list_id: ids.listAlphaId }],
            });

            expect(result.totalB2BCost).toBe(30);

            const client = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.brokeClientId) as any;
            expect(client.wallet_balance).toBe(20); // 50 - 30
        });
    });

    // =====================================================================
    // RECEIPT DELETION REFUND
    // =====================================================================

    describe('Receipt Deletion Refund', () => {

        test('deleting a receipt refunds the exact deducted amount', () => {
            const result = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [
                    { name: 'CBC', mrp: 395, discount: 0, package_list_id: ids.listAlphaId },
                    { name: 'TSH', mrp: 320, discount: 0, package_list_id: ids.listAlphaId },
                ],
            });

            const deducted = result.totalB2BCost; // 250
            const balanceAfterDeduction = (db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.multiLabClientId) as any).wallet_balance;

            // Simulate receipt deletion (mirrors DELETE /admin/receipts/:id)
            const tx = db.prepare('SELECT * FROM transactions WHERE receipt_id = ?').get(result.receiptId) as any;
            db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(tx.amount_deducted, tx.user_id);
            db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
            db.prepare('DELETE FROM receipts WHERE id = ?').run(result.receiptId);

            const balanceAfterRefund = (db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.multiLabClientId) as any).wallet_balance;
            expect(balanceAfterRefund).toBe(10000); // Fully restored
            expect(balanceAfterRefund - balanceAfterDeduction).toBe(deducted);
        });
    });

    // =====================================================================
    // WALK-IN (NON-B2B) RECEIPTS
    // =====================================================================

    describe('Walk-In Receipt Handling', () => {

        test('walk-in receipt does not create any transaction or wallet deduction', () => {
            // Admin creating a receipt WITHOUT acting_as_client
            const receiptResult = db.prepare(`
                INSERT INTO receipts (customer_id, branch_id, created_at, total_mrp, amount_final, amount_received, amount_due, payment_method, num_tests, created_by_user_id, acting_as_client_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(ids.customerId, ids.branchId, '01/01/2026 | 10:00:00 | UTC+5:30', 395, 395, 395, 0, 'Cash', 1, ids.adminId, null);

            const txCount = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE receipt_id = ?').get(receiptResult.lastInsertRowid) as any;
            expect(txCount.c).toBe(0);
        });
    });

    // =====================================================================
    // ADMIN WALLET OPERATIONS
    // =====================================================================

    describe('Admin Wallet Operations', () => {

        test('ADMIN_CREDIT increases wallet balance', () => {
            const creditAmount = 500;
            db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(creditAmount, ids.multiLabClientId);
            const newBalance = (db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.multiLabClientId) as any).wallet_balance;

            db.prepare('INSERT INTO transactions (user_id, date, type, amount_deducted, balance_snapshot, notes) VALUES (?, ?, ?, ?, ?, ?)')
                .run(ids.multiLabClientId, '01/01/2026 | 10:00:00 | UTC+5:30', 'ADMIN_CREDIT', creditAmount, newBalance, 'Test credit');

            expect(newBalance).toBe(10500);
        });

        test('SETTLEMENT zeroes out wallet balance', () => {
            const client = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.multiLabClientId) as any;
            const settlement = -client.wallet_balance;
            db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(settlement, ids.multiLabClientId);

            const newBalance = (db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.multiLabClientId) as any).wallet_balance;
            expect(newBalance).toBe(0);
        });
    });
});
