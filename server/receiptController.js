// medical_receipt_system/server/receiptController.js
const db = require("./db");
const { formatDateForDatabase, formatDateForDisplay, formatTimestampForDisplayIST } = require("./utils/dateUtils");
const { findOrCreateCustomer } = require("./utils/customerUtils");

// Show form (Unchanged)
exports.showReceiptForm = (req, res) => {
    res.render("form_receipt", {});
};

// Create receipt
exports.createReceipt = (req, res) => {
    // --- Session and User Details ---
    if (!req.session.user) {
        return res.status(401).send("Unauthorized");
    }
    const userRole = req.session.user.role;
    const userId = req.session.user.id;
    const branchId = req.session.user.branchId;

    const {
        customer_id,
        new_customer_name,
        new_customer_mobile,
        new_customer_dob,
        new_customer_age,
        new_customer_gender,
        referred_by,
        discount_percentage,
        amount_received,
        num_tests,
        conducted_at,
        payment_method,
        notes,
        due_amount_manual,
        package_names,
        mrps,
        item_discounts,
        package_list_id,
        lab_id
    } = req.body;

    // --- Initial Validation ---
    try {
        // --- Duplicate test check ---
        if (package_names && new Set(package_names).size !== package_names.length) {
            return res.status(400).send("Duplicate tests are not allowed in the same receipt.");
        }

        // Validate customer info
        if (!customer_id && (!new_customer_name || String(new_customer_name).trim() === "")) {
            return res.status(400).send("A customer name is required for new customers.");
        }

        // Validate items
        if (!Array.isArray(package_names) || package_names.length === 0) {
            return res.status(400).send("At least one test/package item is required.");
        }

        // Validate received amount
        const received = parseFloat(amount_received);
        if (isNaN(received) || received < 0) {
            return res.status(400).send("Received Amount must be a valid non-negative number.");
        }

        // Validate overall discount
        const overallDisc = parseFloat(discount_percentage);
        if (isNaN(overallDisc) || overallDisc < 0 || overallDisc > 100) {
            return res.status(400).send("Overall Discount must be a number between 0 and 100.");
        }
    } catch (validationError) {
        console.error("Error during validation:", validationError);
        return res.status(500).send("An error occurred during input validation.");
    }

    // --- Customer Handling ---
    if (!branchId || !userId) {
        return res.redirect("/?error=session");
    }

    let finalCustomerId;
    try {
        if (customer_id && /^\d+$/.test(customer_id)) {
            const existing = db.prepare("SELECT id FROM customers WHERE id = ?").get(customer_id);
            if (!existing) throw new Error(`Selected Customer ID ${customer_id} not found.`);
            finalCustomerId = parseInt(customer_id, 10);
            console.log(`Receipt: Using existing customer ID: ${finalCustomerId}`);
            findOrCreateCustomer({
                id: finalCustomerId,
                name: new_customer_name,
                mobile: new_customer_mobile,
                dob: new_customer_dob,
                age: new_customer_age,
                gender: new_customer_gender,
            });
        } else {
            finalCustomerId = findOrCreateCustomer(
                {
                    name: new_customer_name,
                    mobile: new_customer_mobile,
                    dob: new_customer_dob,
                    age: new_customer_age,
                    gender: new_customer_gender,
                },
                userId // Pass userId here
            );
        }
    } catch (err) {
        console.error("Customer handling error:", err);
        return res.status(400).send(err.message || "Error processing customer information.");
    }

    // --- Secure & Hybrid Item Calculation ---
    if (!package_list_id) {
        return res.status(400).send("A Rate Database must be selected to determine item prices.");
    }
    if (!Array.isArray(item_discounts) || package_names.length !== item_discounts.length) {
        return res.status(400).send("Invalid item discount data.");
    }
    if (userRole !== 'CLIENT' && (!Array.isArray(mrps) || package_names.length !== mrps.length)) {
        return res.status(400).send("Invalid item data. MRPs are missing or inconsistent.");
    }

    // Fetch details for all packages found in the selected list for security.
    const packageDetailsFromDb = db.prepare(`SELECT name, mrp, b2b_price FROM packages WHERE package_list_id = ? AND name IN (${package_names.map(() => '?').join(',')})`).all(package_list_id, ...package_names);
    const packageMap = new Map(packageDetailsFromDb.map(p => [p.name, { mrp: p.mrp, b2b_price: p.b2b_price }]));

    let totalMrp = 0;
    let subtotalAfterItemDiscounts = 0;
    const receiptItemsData = [];
    let totalB2BForDeduction = 0;

    for (let i = 0; i < package_names.length; i++) {
        const name = package_names[i] ? String(package_names[i]).trim() : "";
        const itemDiscountPerc = parseFloat(item_discounts[i]) || 0;
        
        if (!name) continue;
        if (itemDiscountPerc < 0 || itemDiscountPerc > 100) {
            return res.status(400).send(`Invalid item discount for ${name}.`);
        }

        const dbPackage = packageMap.get(name);
        let mrp;
        let b2b_price;

        if (userRole === 'CLIENT') {
            // --- PATH 1: Secure flow for CLIENT Roles ---
            // Clients are not allowed to submit custom items.
            if (!dbPackage) {
                return res.status(400).send(`Item '${name}' not found in the assigned rate database.`);
            }
            mrp = dbPackage.mrp;
            b2b_price = dbPackage.b2b_price ?? mrp; // Fallback to MRP if b2b_price is NULL

        } else {
            // --- PATH 2: Flexible flow for ADMIN and GENERAL Roles ---
            // Prefer database price if package exists, otherwise use form input for custom items.
            if (dbPackage) {
                mrp = dbPackage.mrp;
                b2b_price = dbPackage.b2b_price ?? mrp;
            } else {
                mrp = parseFloat(mrps[i]) || 0;
                b2b_price = mrp; // For custom items, B2B price equals MRP.
            }
        }
        
        if (mrp <= 0) continue; // Skip any item that resolves to an invalid price

        // Accumulate totals
        totalMrp += mrp;
        subtotalAfterItemDiscounts += mrp * (1 - itemDiscountPerc / 100);
        totalB2BForDeduction += b2b_price;
        receiptItemsData.push({ package_name: name, mrp: mrp, b2b_price: b2b_price, discount_percentage: itemDiscountPerc });
    }

    if (receiptItemsData.length === 0) {
        return res.status(400).send("No valid items were found to create a receipt.");
    }

    // --- Final Calculation ---
    const amountReceivedValue = parseFloat(amount_received);
    const overallDiscountPerc = parseFloat(discount_percentage) || 0;
    const amountFinalValue = subtotalAfterItemDiscounts * (1 - overallDiscountPerc / 100);
    
    let amountDueValue;
    const manualDueInput = due_amount_manual !== undefined ? String(due_amount_manual).trim() : "";
    const manualDue = parseFloat(manualDueInput);
    if (manualDueInput !== "" && !isNaN(manualDue) && manualDue >= 0) {
        amountDueValue = manualDue;
    } else {
        amountDueValue = Math.max(0, amountFinalValue - amountReceivedValue);
    }

    const createdAtISO = new Date().toISOString();
    const numTestsValue = num_tests && String(num_tests).trim() !== "" ? parseInt(num_tests, 10) : null;

    // --- Database Transaction: Wallet Deduction & Receipt Creation ---
    const saveReceipt = db.transaction(() => {
        // Step 1: Wallet Deduction for Clients (uses B2B Price, occurs first)
        if (userRole === 'CLIENT') {
            const client = db.prepare("SELECT wallet_balance, allow_negative_balance, negative_balance_allowed_until FROM users WHERE id = ?").get(userId);
            
            if (totalB2BForDeduction > client.wallet_balance) {
                const now = new Date();
                const allowedUntil = client.negative_balance_allowed_until ? new Date(client.negative_balance_allowed_until) : null;
                
                if (!client.allow_negative_balance || !allowedUntil || now > allowedUntil) {
                    // This error will cause the entire transaction to roll back automatically
                    throw new Error(`Insufficient wallet balance. Required: ${totalB2BForDeduction.toFixed(2)}, Available: ${client.wallet_balance.toFixed(2)}.`);
                }
            }
            db.prepare("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?").run(totalB2BForDeduction, userId);
            console.log(`Deducted ${totalB2BForDeduction.toFixed(2)} from wallet of Client ID ${userId}.`);
        }

        // Step 2: Insert the Main Receipt Record
        const receiptSql = `INSERT INTO receipts 
            (branch_id, user_id, customer_id, referred_by, total_mrp, discount_percentage, amount_final, amount_received, amount_due, payment_method, num_tests, conducted_at, notes, created_at, lab_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const receiptStmt = db.prepare(receiptSql);
        const receiptInfo = receiptStmt.run(
            branchId, userId, finalCustomerId, referred_by, totalMrp, overallDiscountPerc,
            amountFinalValue, amountReceivedValue, amountDueValue, payment_method,
            numTestsValue !== null ? numTestsValue : receiptItemsData.length,
            conducted_at, notes, createdAtISO, lab_id
        );
        const newReceiptId = receiptInfo.lastInsertRowid;

        // Step 3: Insert Each Receipt Item (Now includes B2B price for records)
        const itemSql = `INSERT INTO receipt_items (receipt_id, package_name, mrp, b2b_price, discount_percentage) VALUES (?, ?, ?, ?, ?)`;
        const itemStmt = db.prepare(itemSql);
        for (const item of receiptItemsData) {
            itemStmt.run(newReceiptId, item.package_name, item.mrp, item.b2b_price, item.discount_percentage);
        }       
        return newReceiptId;
    });

    // --- Execute Transaction and Respond ---
    try {
        const newReceiptId = saveReceipt();
        console.log(`Receipt (ID: ${newReceiptId}) saved for Customer ID: ${finalCustomerId}`);
        res.redirect(`/receipt/${newReceiptId}`);
    } catch (err) {
        console.error(`Transaction failed for Customer ${finalCustomerId}: ${err.message}\n${err.stack}`);
        // Send the specific error message from the transaction (e.g., "Insufficient wallet balance.") to the user.
        res.status(400).send(err.message || "An error occurred while saving the receipt.");
    }
};


// Show receipt (Unchanged from previous step)
exports.showReceipt = (req, res) => {
    const receiptId = req.params.id;
    if (!receiptId || isNaN(parseInt(receiptId))) { return res.status(400).send("Invalid Receipt ID."); }

    try {
        const receiptData = db.prepare(`
            SELECT r.*, l.logo_path 
            FROM receipts r 
            LEFT JOIN labs l ON r.lab_id = l.id 
            WHERE r.id = ?
        `).get(receiptId);

        if (!receiptData) { return res.status(404).send("Receipt not found."); }

        const customerDetails = db.prepare("SELECT id, name, mobile, dob, age, gender FROM customers WHERE id = ?").get(receiptData.customer_id);
         if (!customerDetails) {
             console.error(`CRITICAL: Customer details not found for customer_id ${receiptData.customer_id} associated with receipt ${receiptId}.`);
             return res.status(500).send("An internal error occurred retrieving customer information.");
         }

        const items = db.prepare("SELECT id, package_name, mrp, discount_percentage FROM receipt_items WHERE receipt_id = ? ORDER BY id").all(receiptId);
        const branchDetails = db.prepare("SELECT id, name, address, phone FROM branches WHERE id = ?").get(receiptData.branch_id);
         if (!branchDetails) {
             console.error(`CRITICAL: Branch details not found for branch_id ${receiptData.branch_id} associated with receipt ${receiptId}.`);
             return res.status(500).send("An internal error occurred retrieving branch information.");
         }

        // --- Data Formatting and Recalculation ---
        let calculatedTotalMrp = 0; let calculatedSubtotalAfterItemDiscounts = 0;
        items.forEach((item) => { const itemMrp = parseFloat(item.mrp) || 0; const itemDiscPerc = parseFloat(item.discount_percentage) || 0; item.mrpFormatted = itemMrp.toFixed(2); item.discountPercentageFormatted = itemDiscPerc.toFixed(1); item.priceAfterItemDiscount = itemMrp * (1 - itemDiscPerc / 100); item.priceAfterItemDiscountFormatted = item.priceAfterItemDiscount.toFixed(2); calculatedTotalMrp += itemMrp; calculatedSubtotalAfterItemDiscounts += item.priceAfterItemDiscount; });
        receiptData.totalMrpFormatted = (receiptData.total_mrp !== null ? parseFloat(receiptData.total_mrp) : calculatedTotalMrp).toFixed(2); receiptData.subtotalAfterItemDiscountsFormatted = calculatedSubtotalAfterItemDiscounts.toFixed(2); const overallDiscPerc = parseFloat(receiptData.discount_percentage) || 0; receiptData.overallDiscountPercentageFormatted = overallDiscPerc.toFixed(1); const calculatedOverallDiscountAmount = calculatedSubtotalAfterItemDiscounts * (overallDiscPerc / 100); receiptData.overallDiscountAmountFormatted = calculatedOverallDiscountAmount.toFixed(2); const dbFinalAmount = parseFloat(receiptData.amount_final) || 0; receiptData.finalAmountFormatted = dbFinalAmount.toFixed(2); receiptData.amountReceivedFormatted = (parseFloat(receiptData.amount_received) || 0).toFixed(2); receiptData.amountDueFormatted = (parseFloat(receiptData.amount_due) || 0).toFixed(2);
        receiptData.displayReceiptDate = formatTimestampForDisplayIST(receiptData.created_at);
        customerDetails.displayDob = formatDateForDisplay(customerDetails.dob);
        
        // Pass the lab logo path to the view
        const labLogoPath = receiptData.logo_path;

        // --- Render View ---
        res.render("receipt", { receiptData, customerDetails, items, branchDetails, labLogoPath });

    } catch (err) {
        console.error(`Error fetching receipt ID ${receiptId}: ${err.message}\n${err.stack}`);
        res.status(500).send("An internal server error occurred.");
    }
};