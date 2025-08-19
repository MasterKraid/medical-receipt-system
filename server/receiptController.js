// medical_receipt_system/server/receiptController.js
const db = require("./db");
const { formatDateForDatabase, formatDateForDisplay, formatTimestampForDisplayIST } = require('./utils/dateUtils');
// Import the centralized customer helper using the CORRECT path
const { findOrCreateCustomer } = require('./utils/customerUtils'); // Corrected path

// Show form (Unchanged)
exports.showReceiptForm = (req, res) => {
    res.render("form_receipt", {});
};

// Create receipt (Uses imported findOrCreateCustomer)
exports.createReceipt = (req, res) => {
    if (!req.session.user) { return res.status(401).send("Unauthorized"); }
    const userId = req.session.user.id;
    const branchId = req.session.user.branchId;

    const {
        customer_id, new_customer_name, new_customer_mobile, new_customer_dob, new_customer_age, new_customer_gender, // Customer fields
        referred_by, discount_percentage, amount_received, num_tests, conducted_at, payment_method, notes, due_amount_manual, // Receipt fields
        package_names, mrps, item_discounts, // Item fields
    } = req.body;

    try {
        // Validate customer info: If no existing customer is selected, a new name is mandatory.
        if (!customer_id && (!new_customer_name || String(new_customer_name).trim() === '')) {
            return res.status(400).send("A customer name is required for new customers.");
        }

        // Validate items: Must have at least one item.
        if (!Array.isArray(package_names) || package_names.length === 0) {
            return res.status(400).send("At least one test/package item is required.");
        }
        
        // Validate core numeric fields
        const received = parseFloat(amount_received);
        if (isNaN(received) || received < 0) {
            return res.status(400).send("Received Amount must be a valid non-negative number.");
        }

        const overallDisc = parseFloat(discount_percentage);
        if (isNaN(overallDisc) || overallDisc < 0 || overallDisc > 100) {
            return res.status(400).send("Overall Discount must be a number between 0 and 100.");
        }
    } catch (validationError) {
        // This catch block is for unexpected errors during the validation itself.
        console.error("Error during validation:", validationError);
        return res.status(500).send("An error occurred during input validation.");
    }
    
    // --- Validation & Customer Handling ---
    if (!branchId || !userId) { return res.redirect('/?error=session'); }

    let finalCustomerId;
    try {
        if (customer_id && /^\d+$/.test(customer_id)) {
            const existing = db.prepare("SELECT id FROM customers WHERE id = ?").get(customer_id);
            if (!existing) throw new Error(`Selected Customer ID ${customer_id} not found.`);
            finalCustomerId = parseInt(customer_id, 10);
            console.log(`Receipt: Using existing customer ID: ${finalCustomerId}`);
             findOrCreateCustomer({ // Call to potentially update
                id: finalCustomerId, name: new_customer_name, mobile: new_customer_mobile, dob: new_customer_dob, age: new_customer_age, gender: new_customer_gender
            });
        } else {
            finalCustomerId = findOrCreateCustomer({
                name: new_customer_name, mobile: new_customer_mobile, dob: new_customer_dob, age: new_customer_age, gender: new_customer_gender
            });
        }
    } catch (err) {
        console.error("Customer handling error:", err);
        return res.status(400).send(err.message || "Error processing customer information.");
    }

    // --- Item/Receipt Field Validation ---
    if ( !Array.isArray(package_names) || !Array.isArray(mrps) || !Array.isArray(item_discounts) || package_names.length === 0 || package_names.length !== mrps.length || package_names.length !== item_discounts.length ) {
        return res.status(400).send("Invalid item data.");
    }
    if (amount_received === undefined || amount_received === null || String(amount_received).trim() === '' || isNaN(parseFloat(amount_received))) {
        return res.status(400).send("Received Amount is required and must be a number.");
    }
    const amountReceivedValue = parseFloat(amount_received);
    if (amountReceivedValue < 0) { return res.status(400).send("Received Amount cannot be negative."); }
    const overallDiscountPerc = parseFloat(discount_percentage) || 0;
    if (overallDiscountPerc < 0 || overallDiscountPerc > 100) { return res.status(400).send("Invalid Overall Discount."); }
    // Add other validations as needed (num_tests etc.)

    // --- Calculation ---
    let totalMrp = 0; let subtotalAfterItemDiscounts = 0; const receiptItemsData = [];
    for (let i = 0; i < package_names.length; i++) {
        const name = package_names[i] ? String(package_names[i]).trim() : "";
        const mrp = parseFloat(mrps[i]) || 0; const itemDiscountPerc = parseFloat(item_discounts[i]) || 0;
        if (!name || mrp <= 0) { continue; } if (itemDiscountPerc < 0 || itemDiscountPerc > 100) { return res.status(400).send(`Invalid item discount for ${name}.`); }
        totalMrp += mrp; subtotalAfterItemDiscounts += mrp * (1 - itemDiscountPerc / 100);
        receiptItemsData.push({ package_name: name, mrp: mrp, discount_percentage: itemDiscountPerc });
    }
    if (receiptItemsData.length === 0) { return res.status(400).send("No valid items found."); }

    const amountFinalValue = subtotalAfterItemDiscounts * (1 - overallDiscountPerc / 100);
    let amountDueValue;
    const manualDueInput = due_amount_manual !== undefined ? String(due_amount_manual).trim() : ""; const manualDue = parseFloat(manualDueInput);
    if (manualDueInput !== "" && !isNaN(manualDue) && manualDue >= 0) { amountDueValue = manualDue; } else { amountDueValue = Math.max(0, amountFinalValue - amountReceivedValue); }
    const createdAtISO = new Date().toISOString();
    const numTestsValue = num_tests && String(num_tests).trim() !== '' ? parseInt(num_tests, 10) : null;

    // --- Database Transaction ---
    const saveReceipt = db.transaction(() => {
        const receiptSql = `INSERT INTO receipts (branch_id, user_id, customer_id, referred_by, total_mrp, discount_percentage, amount_final, amount_received, amount_due, payment_method, num_tests, conducted_at, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const receiptStmt = db.prepare(receiptSql);
        const receiptInfo = receiptStmt.run(
            branchId, userId, finalCustomerId, referred_by, totalMrp,
            overallDiscountPerc, amountFinalValue, amountReceivedValue, amountDueValue, payment_method,
            numTestsValue !== null ? numTestsValue : receiptItemsData.length,
            conducted_at, notes, createdAtISO
        );
        const newReceiptId = receiptInfo.lastInsertRowid;

        const itemSql = `INSERT INTO receipt_items (receipt_id, package_name, mrp, discount_percentage) VALUES (?, ?, ?, ?)`;
        const itemStmt = db.prepare(itemSql);
        for (const item of receiptItemsData) {
            if (!item.package_name) { continue; } // Safety check
            itemStmt.run(newReceiptId, item.package_name, item.mrp, item.discount_percentage);
        }
        return newReceiptId;
    });

    // --- Execute and Respond ---
    try {
        const newReceiptId = saveReceipt();
        console.log(`Receipt (ID: ${newReceiptId}) saved for Customer ID: ${finalCustomerId}`);
        res.redirect(`/receipt/${newReceiptId}`);
    } catch (err) {
        console.error(`Error saving receipt for Customer ${finalCustomerId}: ${err.message}\n${err.stack}`);
        res.status(500).send("An error occurred while saving the receipt.");
    }
};


// Show receipt (Unchanged from previous step)
exports.showReceipt = (req, res) => {
    const receiptId = req.params.id;
    if (!receiptId || isNaN(parseInt(receiptId))) { return res.status(400).send("Invalid Receipt ID."); }

    try {
        const receiptData = db.prepare("SELECT * FROM receipts WHERE id = ?").get(receiptId);
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

        // --- Render View ---
        res.render("receipt", { receiptData, customerDetails, items, branchDetails });

    } catch (err) {
        console.error(`Error fetching receipt ID ${receiptId}: ${err.message}\n${err.stack}`);
        res.status(500).send("An internal server error occurred.");
    }
};