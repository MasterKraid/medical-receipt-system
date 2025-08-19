// medical_receipt_system/server/estimateController.js
const db = require("./db");
const { formatDateForDatabase, formatDateForDisplay } = require('./utils/dateUtils');
// Import the centralized customer helper using the CORRECT path
const { findOrCreateCustomer } = require('./utils/customerUtils'); // Corrected path

// Show form (Unchanged)
exports.showEstimateForm = (req, res) => {
    res.render("form_estimate", {});
};

// Create estimate (Uses imported findOrCreateCustomer)
exports.createEstimate = (req, res) => {
    if (!req.session.user) { return res.status(401).send("Unauthorized"); }
    const userId = req.session.user.id;
    const branchId = req.session.user.branchId;

    const {
        customer_id, new_customer_name, new_customer_mobile, new_customer_dob, new_customer_age, new_customer_gender, // Customer fields
        estimate_date, referred_by, discount_percentage, notes, // Estimate fields
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
        const overallDisc = parseFloat(discount_percentage);
        if (isNaN(overallDisc) || overallDisc < 0 || overallDisc > 100) {
            return res.status(400).send("Overall Discount must be a number between 0 and 100.");
        }
    } catch (validationError) {
        console.error("Error during validation:", validationError);
        return res.status(500).send("An error occurred during input validation.");
    }

    // --- Validation & Customer Handling ---
    if (!branchId || !userId) { return res.redirect('/?error=session'); }
    const estimateDateForDb = formatDateForDatabase(estimate_date);
    if (!estimateDateForDb) { return res.status(400).send("Valid Estimate Date is required."); }

    let finalCustomerId;
    try {
        if (customer_id && /^\d+$/.test(customer_id)) {
            const existing = db.prepare("SELECT id FROM customers WHERE id = ?").get(customer_id);
            if (!existing) throw new Error(`Selected Customer ID ${customer_id} not found.`);
            finalCustomerId = parseInt(customer_id, 10);
            console.log(`Estimate: Using existing customer ID: ${finalCustomerId}`);
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

    // --- Item validation & Calculation ---
    if ( !Array.isArray(package_names) || !Array.isArray(mrps) || !Array.isArray(item_discounts) || package_names.length === 0 || package_names.length !== mrps.length || package_names.length !== item_discounts.length ) {
         return res.status(400).send("Invalid item data.");
    }
    let totalMrp = 0; let subtotalAfterItemDiscounts = 0; const estimateItemsData = [];
    const overallDiscountPerc = parseFloat(discount_percentage) || 0;
    if (overallDiscountPerc < 0 || overallDiscountPerc > 100) { return res.status(400).send("Invalid Overall Discount."); }
    for (let i = 0; i < package_names.length; i++) {
        const name = package_names[i] ? String(package_names[i]).trim() : "";
        const mrp = parseFloat(mrps[i]) || 0; const itemDiscountPerc = parseFloat(item_discounts[i]) || 0;
        if (!name || mrp <= 0) { continue; } if (itemDiscountPerc < 0 || itemDiscountPerc > 100) { return res.status(400).send(`Invalid item discount for ${name}.`); }
        totalMrp += mrp; subtotalAfterItemDiscounts += mrp * (1 - itemDiscountPerc / 100);
        estimateItemsData.push({ package_name: name, mrp: mrp, discount_percentage: itemDiscountPerc });
    }
    if (estimateItemsData.length === 0) { return res.status(400).send("No valid items found."); }
    const finalAmount = subtotalAfterItemDiscounts * (1 - overallDiscountPerc / 100);
    const createdAtISO = new Date().toISOString();

    // --- Database Transaction ---
    const saveEstimate = db.transaction(() => {
        const estimateSql = `INSERT INTO estimates (branch_id, user_id, customer_id, estimate_date, referred_by, discount_percentage, amount_after_discount, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const estimateStmt = db.prepare(estimateSql);
        const estimateInfo = estimateStmt.run(branchId, userId, finalCustomerId, estimateDateForDb, referred_by, overallDiscountPerc, finalAmount, notes, createdAtISO);
        const newEstimateId = estimateInfo.lastInsertRowid;

        const itemSql = `INSERT INTO estimate_items (estimate_id, package_name, mrp, discount_percentage) VALUES (?, ?, ?, ?)`;
        const itemStmt = db.prepare(itemSql);
        for (const item of estimateItemsData) {
            itemStmt.run(newEstimateId, item.package_name, item.mrp, item.discount_percentage);
        }
        return newEstimateId;
    });

    // --- Execute and Respond ---
    try {
        const newEstimateId = saveEstimate();
        console.log(`Estimate (ID: ${newEstimateId}) saved for Customer ID: ${finalCustomerId}`);
        res.redirect(`/estimate/${newEstimateId}`);
    } catch (err) {
        console.error(`Error saving estimate for Customer ${finalCustomerId}: ${err.message}\n${err.stack}`);
        res.status(500).send("An error occurred while saving the estimate.");
    }
};


// Show estimate (Unchanged from previous step)
exports.showEstimate = (req, res) => {
    const estimateId = req.params.id;
    if (!estimateId || isNaN(parseInt(estimateId))) { return res.status(400).send("Invalid Estimate ID."); }

    try {
        const estimateData = db.prepare("SELECT * FROM estimates WHERE id = ?").get(estimateId);
        if (!estimateData) { return res.status(404).send("Estimate not found."); }

        const customerDetails = db.prepare("SELECT id, name, mobile, dob, age, gender FROM customers WHERE id = ?").get(estimateData.customer_id);
        if (!customerDetails) {
             console.error(`CRITICAL: Customer details not found for customer_id ${estimateData.customer_id} associated with estimate ${estimateId}.`);
             return res.status(500).send("An internal error occurred retrieving customer information.");
        }

        const items = db.prepare("SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY id").all(estimateId);
        const branchDetails = db.prepare("SELECT id, name, address, phone FROM branches WHERE id = ?").get(estimateData.branch_id);
        if (!branchDetails) {
             console.error(`CRITICAL: Branch details not found for branch_id ${estimateData.branch_id} associated with estimate ${estimateId}.`);
             return res.status(500).send("An internal error occurred retrieving branch information.");
         }

        // --- Data Formatting and Calculation ---
        let calculatedTotalMrp = 0; let calculatedSubtotalAfterItemDiscounts = 0;
        items.forEach((item) => { const itemMrp = parseFloat(item.mrp) || 0; const itemDiscPerc = parseFloat(item.discount_percentage) || 0; item.mrpFormatted = itemMrp.toFixed(2); item.discountPercentageFormatted = itemDiscPerc.toFixed(1); item.priceAfterItemDiscount = itemMrp * (1 - itemDiscPerc / 100); item.priceAfterItemDiscountFormatted = item.priceAfterItemDiscount.toFixed(2); calculatedTotalMrp += itemMrp; calculatedSubtotalAfterItemDiscounts += item.priceAfterItemDiscount; });
        estimateData.totalMrpFormatted = calculatedTotalMrp.toFixed(2); estimateData.subtotalAfterItemDiscountsFormatted = calculatedSubtotalAfterItemDiscounts.toFixed(2); const overallDiscPerc = parseFloat(estimateData.discount_percentage) || 0; estimateData.overallDiscountPercentageFormatted = overallDiscPerc.toFixed(1); const calculatedOverallDiscountAmount = calculatedSubtotalAfterItemDiscounts * (overallDiscPerc / 100); estimateData.overallDiscountAmountFormatted = calculatedOverallDiscountAmount.toFixed(2); const dbFinalAmount = parseFloat(estimateData.amount_after_discount) || 0; estimateData.finalAmountFormatted = dbFinalAmount.toFixed(2);
        estimateData.displayEstimateDate = formatDateForDisplay(estimateData.estimate_date);
        customerDetails.displayDob = formatDateForDisplay(customerDetails.dob);

        // --- Render View ---
        res.render("estimate", { estimateData, customerDetails, items, branchDetails });

    } catch (err) {
        console.error(`Error fetching estimate ID ${estimateId}: ${err.message}\n${err.stack}`);
        res.status(500).send("An internal server error occurred.");
    }
};