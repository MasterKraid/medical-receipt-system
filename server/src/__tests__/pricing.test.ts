/**
 * B2B Pricing Isolation Tests
 * 
 * These tests verify the CORE invariant that was violated by the cross-laboratory
 * pricing bug: B2B prices must ALWAYS be resolved from the specific package_list_id
 * attached to each item, never from a broader set of the client's accessible lists.
 */
import { createTestDb, seedMultiLabScenario, calculateB2BCost, createReceiptWithDeduction } from './setup';

describe('B2B Pricing Isolation', () => {
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
    // CROSS-LAB LEAK PREVENTION (the original bug)
    // =====================================================================

    describe('Cross-Laboratory Price Leak Prevention', () => {

        test('B2B cost for "CBC" must differ depending on which list it is submitted under', () => {
            // CBC in Alpha = 150, CBC in Beta = 120
            const costAlpha = calculateB2BCost(db, [{ name: 'CBC', package_list_id: ids.listAlphaId }], ids.multiLabClientId);
            const costBeta = calculateB2BCost(db, [{ name: 'CBC', package_list_id: ids.listBetaId }], ids.multiLabClientId);

            expect(costAlpha).toBe(150);
            expect(costBeta).toBe(120);
            expect(costAlpha).not.toBe(costBeta);
        });

        test('submitting a Beta-only test under Alpha list must throw', () => {
            // "Beta Only Test" exists only in list 20 (Beta), not in list 10 (Alpha)
            expect(() => {
                calculateB2BCost(db, [{ name: 'Beta Only Test', package_list_id: ids.listAlphaId }], ids.multiLabClientId);
            }).toThrow("not available in the selected laboratory/rate database");
        });

        test('submitting an Alpha-only test under Beta list must throw', () => {
            expect(() => {
                calculateB2BCost(db, [{ name: 'Alpha Only Test', package_list_id: ids.listBetaId }], ids.multiLabClientId);
            }).toThrow("not available in the selected laboratory/rate database");
        });

        test('multi-lab client receipt deduction uses per-item list, not cross-list resolution', () => {
            // Submit 2 items: CBC from Alpha (b2b=150) and Glucose from Beta (b2b=24)
            const result = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [
                    { name: 'CBC', mrp: 395, discount: 0, package_list_id: ids.listAlphaId },
                    { name: 'Glucose Fasting', mrp: 85, discount: 0, package_list_id: ids.listBetaId },
                ],
            });

            // Expected: 150 (Alpha CBC) + 24 (Beta Glucose) = 174
            expect(result.totalB2BCost).toBe(174);

            // Wallet should be 10000 - 174 = 9826
            const client = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.multiLabClientId) as any;
            expect(client.wallet_balance).toBe(9826);
        });

        test('same test name from different lists must yield different wallet deductions', () => {
            // TSH from Alpha (b2b=100) vs TSH from Beta (b2b=60)
            const resultAlpha = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [{ name: 'TSH', mrp: 320, discount: 0, package_list_id: ids.listAlphaId }],
            });
            expect(resultAlpha.totalB2BCost).toBe(100);

            const resultBeta = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [{ name: 'TSH', mrp: 350, discount: 0, package_list_id: ids.listBetaId }],
            });
            expect(resultBeta.totalB2BCost).toBe(60);
        });
    });

    // =====================================================================
    // PACKAGE LIST ACCESS AUTHORIZATION
    // =====================================================================

    describe('Package List Access Control', () => {

        test('client cannot use a package list they do not have access to', () => {
            // single_lab_client (200) only has access to list 10 (Alpha)
            expect(() => {
                calculateB2BCost(db, [{ name: 'CBC', package_list_id: ids.listBetaId }], ids.singleLabClientId);
            }).toThrow("Unauthorized or missing rate category");
        });

        test('submitting item with package_list_id=0 must throw', () => {
            expect(() => {
                calculateB2BCost(db, [{ name: 'CBC', package_list_id: 0 }], ids.multiLabClientId);
            }).toThrow("Unauthorized or missing rate category");
        });

        test('submitting item with nonexistent package_list_id must throw', () => {
            expect(() => {
                calculateB2BCost(db, [{ name: 'CBC', package_list_id: 9999 }], ids.multiLabClientId);
            }).toThrow("Unauthorized or missing rate category");
        });

        test('submitting nonexistent test name in a valid list must throw', () => {
            expect(() => {
                calculateB2BCost(db, [{ name: 'NONEXISTENT TEST', package_list_id: ids.listAlphaId }], ids.multiLabClientId);
            }).toThrow("not available in the selected laboratory/rate database");
        });
    });

    // =====================================================================
    // RECEIPT ITEM STORAGE INTEGRITY
    // =====================================================================

    describe('Receipt Item Storage', () => {

        test('receipt items are stored with their specific package_list_id', () => {
            const result = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [
                    { name: 'CBC', mrp: 395, discount: 0, package_list_id: ids.listAlphaId },
                    { name: 'Beta Only Test', mrp: 1000, discount: 0, package_list_id: ids.listBetaId },
                ],
            });

            const storedItems = db.prepare('SELECT package_name, package_list_id FROM receipt_items WHERE receipt_id = ?').all(result.receiptId) as any[];
            expect(storedItems).toHaveLength(2);
            expect(storedItems[0].package_list_id).toBe(ids.listAlphaId);
            expect(storedItems[1].package_list_id).toBe(ids.listBetaId);
        });

        test('no receipt items should be stored with NULL package_list_id for new receipts', () => {
            const result = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.multiLabClientId,
                actingAsClientId: null,
                items: [
                    { name: 'CBC', mrp: 395, discount: 0, package_list_id: ids.listAlphaId },
                ],
            });

            const nullItems = db.prepare('SELECT COUNT(*) as c FROM receipt_items WHERE receipt_id = ? AND package_list_id IS NULL').get(result.receiptId) as any;
            expect(nullItems.c).toBe(0);
        });
    });

    // =====================================================================
    // ADMIN/DATA_ENTRY ACTING AS CLIENT
    // =====================================================================

    describe('Acting-As-Client Pricing', () => {

        test('admin creating receipt on behalf of multi-lab client uses correct per-item pricing', () => {
            const result = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.adminId,
                actingAsClientId: ids.multiLabClientId,
                items: [
                    { name: 'CBC', mrp: 330, discount: 0, package_list_id: ids.listBetaId },
                    { name: 'Alpha Only Test', mrp: 500, discount: 0, package_list_id: ids.listAlphaId },
                ],
            });

            // CBC Beta (120) + Alpha Only Test (200) = 320
            expect(result.totalB2BCost).toBe(320);

            // Wallet deducted from the CLIENT, not the admin
            const client = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.multiLabClientId) as any;
            expect(client.wallet_balance).toBe(10000 - 320);

            // Admin wallet should be untouched (admins don't have wallet_balance tracked)
            const admin = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(ids.adminId) as any;
            expect(admin.wallet_balance).toBe(0);
        });

        test('transaction record links to the client, not the admin', () => {
            const result = createReceiptWithDeduction(db, {
                customerId: ids.customerId,
                branchId: ids.branchId,
                createdByUserId: ids.adminId,
                actingAsClientId: ids.multiLabClientId,
                items: [
                    { name: 'Glucose Fasting', mrp: 85, discount: 0, package_list_id: ids.listAlphaId },
                ],
            });

            const tx = db.prepare('SELECT * FROM transactions WHERE receipt_id = ?').get(result.receiptId) as any;
            expect(tx.user_id).toBe(ids.multiLabClientId);
            expect(tx.type).toBe('RECEIPT_DEDUCTION');
            expect(tx.amount_deducted).toBe(30); // Alpha Glucose Fasting b2b
        });
    });
});
