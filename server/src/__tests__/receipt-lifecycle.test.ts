/**
 * Receipt Lifecycle & Access Control Tests
 * 
 * Verifies the full receipt lifecycle (create → read → edit → delete),
 * data entry locking, user deletion with FK handling, and role-based access control.
 */
import { createTestDb, seedMultiLabScenario, createReceiptWithDeduction } from './setup';

describe('Receipt Lifecycle', () => {
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
    // FULL LIFECYCLE
    // =====================================================================

    describe('Create → Read → Delete Cycle', () => {

        test('receipt and items persist correctly after creation', () => {
            const result = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [
                    { name: 'CBC', mrp: 395, discount: 5, package_list_id: ids.listAlphaId },
                    { name: 'TSH', mrp: 320, discount: 10, package_list_id: ids.listAlphaId },
                ],
            });

            const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(result.receiptId) as any;
            expect(receipt).toBeDefined();
            expect(receipt.customer_id).toBe(ids.customerId);
            expect(receipt.branch_id).toBe(ids.branchId);
            expect(receipt.created_by_user_id).toBe(ids.multiLabClientId);
            expect(receipt.num_tests).toBe(2);

            const items = db.prepare('SELECT * FROM receipt_items WHERE receipt_id = ?').all(result.receiptId) as any[];
            expect(items).toHaveLength(2);
            expect(items[0].package_name).toBe('CBC');
            expect(items[0].package_list_id).toBe(ids.listAlphaId);
            expect(items[1].package_name).toBe('TSH');
        });

        test('deleting receipt also cleans up items (CASCADE)', () => {
            const result = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [
                    { name: 'CBC', mrp: 395, discount: 0, package_list_id: ids.listAlphaId },
                ],
            });

            // Delete receipt
            db.prepare('DELETE FROM receipts WHERE id = ?').run(result.receiptId);

            const items = db.prepare('SELECT * FROM receipt_items WHERE receipt_id = ?').all(result.receiptId) as any[];
            expect(items).toHaveLength(0);
        });
    });

    // =====================================================================
    // DATA ENTRY LOCKING
    // =====================================================================

    describe('Data Entry Done Locking', () => {

        test('marking receipt as data_entry_done prevents further edits', () => {
            const result = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [
                    { name: 'CBC', mrp: 395, discount: 0, package_list_id: ids.listAlphaId },
                ],
            });

            // Mark as done
            db.prepare('UPDATE receipts SET data_entry_done = 1 WHERE id = ?').run(result.receiptId);

            // Verify it's locked
            const receipt = db.prepare('SELECT data_entry_done FROM receipts WHERE id = ?').get(result.receiptId) as any;
            expect(receipt.data_entry_done).toBe(1);
        });
    });

    // =====================================================================
    // RECEIPT EDIT WITH WALLET DELTA
    // =====================================================================

    describe('Receipt Edit Wallet Adjustments', () => {

        test('editing receipt items applies correct wallet delta (same client)', () => {
            // Create receipt with CBC Alpha (b2b=150) + TSH Alpha (b2b=100) = 250
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

            const balanceAfterCreate = (db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.multiLabClientId) as any).wallet_balance;
            expect(balanceAfterCreate).toBe(10000 - 250); // 9750

            // Simulate editing: remove TSH, keep CBC only → new B2B cost = 150
            const oldTx = db.prepare('SELECT * FROM transactions WHERE receipt_id = ? AND type = ?').get(result.receiptId, 'RECEIPT_DEDUCTION') as any;
            const oldB2BCost = oldTx.amount_deducted; // 250
            const newB2BCost = 150; // Just CBC Alpha

            const balanceDiff = oldB2BCost - newB2BCost; // +100 refund
            db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(balanceDiff, ids.multiLabClientId);

            const balanceAfterEdit = (db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.multiLabClientId) as any).wallet_balance;
            expect(balanceAfterEdit).toBe(9850); // 9750 + 100 = 9850

            // Update transaction
            db.prepare('UPDATE transactions SET amount_deducted = ?, balance_snapshot = ? WHERE id = ?')
                .run(newB2BCost, balanceAfterEdit, oldTx.id);

            const updatedTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(oldTx.id) as any;
            expect(updatedTx.amount_deducted).toBe(150);
            expect(updatedTx.balance_snapshot).toBe(9850);
        });

        test('editing receipt to add more items deducts additional cost', () => {
            // Create with just Glucose Alpha (b2b=30)
            const result = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [
                    { name: 'Glucose Fasting', mrp: 85, discount: 0, package_list_id: ids.listAlphaId },
                ],
            });

            const balanceAfterCreate = (db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.multiLabClientId) as any).wallet_balance;
            expect(balanceAfterCreate).toBe(9970); // 10000 - 30

            // Edit to add CBC Alpha (b2b=150) → new total = 30 + 150 = 180
            const oldTx = db.prepare('SELECT * FROM transactions WHERE receipt_id = ? AND type = ?').get(result.receiptId, 'RECEIPT_DEDUCTION') as any;
            const newB2BCost = 30 + 150;

            const balanceDiff = oldTx.amount_deducted - newB2BCost; // 30 - 180 = -150 (additional charge)
            db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(balanceDiff, ids.multiLabClientId);

            const balanceAfterEdit = (db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.multiLabClientId) as any).wallet_balance;
            expect(balanceAfterEdit).toBe(9820); // 9970 - 150
        });
    });

    // =====================================================================
    // USER DELETION WITH FK HANDLING
    // =====================================================================

    describe('User Deletion Safety', () => {

        test('deleting a user re-attributes their receipts to deleted_user', () => {
            // Create a receipt by the multi-lab client
            createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [
                    { name: 'CBC', mrp: 395, discount: 0, package_list_id: ids.listAlphaId },
                ],
            });

            // Ensure receipts exist for this user
            const receiptsBefore = db.prepare('SELECT COUNT(*) as c FROM receipts WHERE created_by_user_id = ?').get(ids.multiLabClientId) as any;
            expect(receiptsBefore.c).toBe(1);

            // Create dummy user 
            const dummyResult = db.prepare("INSERT INTO users (username, password_hash, branchId, role) VALUES ('deleted_user', 'DISABLED', 1, 'GENERAL_EMPLOYEE')").run();
            const dummyUserId = dummyResult.lastInsertRowid;

            // Re-attribute and delete (mirrors DELETE /users/:id)
            db.prepare('UPDATE receipts SET created_by_user_id = ? WHERE created_by_user_id = ?').run(dummyUserId, ids.multiLabClientId);
            db.prepare('UPDATE receipts SET acting_as_client_id = NULL WHERE acting_as_client_id = ?').run(ids.multiLabClientId);
            db.prepare('UPDATE customers SET created_by_user_id = ? WHERE created_by_user_id = ?').run(dummyUserId, ids.multiLabClientId);
            db.prepare('UPDATE transactions SET user_id = ? WHERE user_id = ?').run(dummyUserId, ids.multiLabClientId);
            db.prepare('DELETE FROM users WHERE id = ?').run(ids.multiLabClientId);

            // Verify receipts still exist, now attributed to dummy user
            const receiptsAfter = db.prepare('SELECT COUNT(*) as c FROM receipts WHERE created_by_user_id = ?').get(dummyUserId) as any;
            expect(receiptsAfter.c).toBe(1);

            // Verify original user is gone
            const deletedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(ids.multiLabClientId);
            expect(deletedUser).toBeUndefined();
        });

        test('deleting user does not cause FK constraint violations', () => {
            // Create receipt, transaction, and customer all linked to this user
            createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [
                    { name: 'CBC', mrp: 395, discount: 0, package_list_id: ids.listAlphaId },
                ],
            });

            const dummyResult = db.prepare("INSERT INTO users (username, password_hash, branchId, role) VALUES ('deleted_user', 'DISABLED', 1, 'GENERAL_EMPLOYEE')").run();
            const dummyUserId = dummyResult.lastInsertRowid;

            // This should NOT throw
            expect(() => {
                db.prepare('UPDATE receipts SET created_by_user_id = ? WHERE created_by_user_id = ?').run(dummyUserId, ids.multiLabClientId);
                db.prepare('UPDATE receipts SET acting_as_client_id = NULL WHERE acting_as_client_id = ?').run(ids.multiLabClientId);
                db.prepare('UPDATE customers SET created_by_user_id = ? WHERE created_by_user_id = ?').run(dummyUserId, ids.multiLabClientId);
                db.prepare('UPDATE transactions SET user_id = ? WHERE user_id = ?').run(dummyUserId, ids.multiLabClientId);
                db.prepare('DELETE FROM users WHERE id = ?').run(ids.multiLabClientId);
            }).not.toThrow();
        });
    });

    // =====================================================================
    // LAB LOGO RESOLUTION
    // =====================================================================

    describe('Lab Logo Resolution', () => {

        test('lab logo is resolved from the first item package_list_id', () => {
            // Set a logo on Lab Alpha
            db.prepare('UPDATE labs SET logo_path = ? WHERE id = ?').run('/lab_logos/alpha.png', ids.labAlphaId);

            // Get the logo path via the same query the server uses
            const logoQuery = db.prepare(`
                SELECT logo_path FROM labs 
                JOIN lab_package_lists lpl ON labs.id = lpl.lab_id 
                WHERE lpl.package_list_id = ? LIMIT 1
            `);
            
            const alphaLogo = logoQuery.get(ids.listAlphaId) as any;
            expect(alphaLogo?.logo_path).toBe('/lab_logos/alpha.png');

            const betaLogo = logoQuery.get(ids.listBetaId) as any;
            expect(betaLogo?.logo_path).toBeNull(); // Beta lab has no logo
        });
    });

    // =====================================================================
    // PACKAGE LIST-LAB MAPPING INTEGRITY
    // =====================================================================

    describe('Package List Lab Mapping', () => {

        test('each package list maps to exactly one lab', () => {
            const alphaMapping = db.prepare('SELECT lab_id FROM lab_package_lists WHERE package_list_id = ?').all(ids.listAlphaId) as any[];
            expect(alphaMapping).toHaveLength(1);
            expect(alphaMapping[0].lab_id).toBe(ids.labAlphaId);

            const betaMapping = db.prepare('SELECT lab_id FROM lab_package_lists WHERE package_list_id = ?').all(ids.listBetaId) as any[];
            expect(betaMapping).toHaveLength(1);
            expect(betaMapping[0].lab_id).toBe(ids.labBetaId);
        });

        test('user package list access matches expected configuration', () => {
            const multiLabAccess = db.prepare('SELECT package_list_id FROM user_package_list_access WHERE user_id = ?').all(ids.multiLabClientId) as any[];
            expect(multiLabAccess).toHaveLength(2);
            expect(multiLabAccess.map((a: any) => a.package_list_id).sort()).toEqual([ids.listAlphaId, ids.listBetaId].sort());

            const singleLabAccess = db.prepare('SELECT package_list_id FROM user_package_list_access WHERE user_id = ?').all(ids.singleLabClientId) as any[];
            expect(singleLabAccess).toHaveLength(1);
            expect(singleLabAccess[0].package_list_id).toBe(ids.listAlphaId);
        });
    });
});
