// medical_receipt_system/server/estimateController.js
const db = require("./db");
const { formatDateForDatabase, formatDateForDisplay } = require("./utils/dateUtils");
const { findOrCreateCustomer } = require("./utils/customerUtils");

// Show form (Unchanged)
exports.showEstimateForm = (req, res) => {
    res.render("form_estimate", {});
};

// Create estimate
exports.createEstimate = (req, res) => {
    // --- Session and User Details ---
    if (!req.session.user) {
        return res.status(401).send("Unauthorized");
    }
    const { id: userId, branchId, role } = req.session.user;

    // --- Destructure all required fields from the form ---
    const {
        customer_id, new_customer_name, new_customer_mobile, new_customer_dob, new_customer_age, new_customer_gender,
        lab_id, package_list_id,
        estimate_date, referred_by, notes,
        package_names, mrps, item_discounts,
    } = req.body;

    // --- Initial Validation ---
    try {
        if (package_names && new Set(package_names).size !== package_names.length) {
            return res.status(400).send("Duplicate tests are not allowed in the same estimate.");
        }
        if (!package_list_id) {
            return res.status(400).send("A Rate Database must be selected to determine item prices.");
        }
         if (!lab_id) {
            return res.status(400).send("A Lab must be selected.");
        }
        if (!Array.isArray(package_names) || package_names.length === 0) {
            return res.status(400).send("At least one test/package item is required.");
        }
    } catch (validationError) {
        console.error("Error during validation:", validationError);
        return res.status(500).send("An error occurred during input validation.");
    }

    // --- Customer Handling ---
    let finalCustomerId;
    try {
         if (customer_id && /^\d+$/.test(customer_id)) {
            const existing = db.prepare("SELECT id FROM customers WHERE id = ?").get(customer_id);
            if (!existing) throw new Error(`Selected Customer ID ${customer_id} not found.`);
            finalCustomerId = parseInt(customer_id, 10);
            findOrCreateCustomer({ id: finalCustomerId, name: new_customer_name, mobile: new_customer_mobile, dob: new_customer_dob, age: new_customer_age, gender: new_customer_gender });
        } else {
            finalCustomerId = findOrCreateCustomer({
                name: new_customer_name, mobile: new_customer_mobile, dob: new_customer_dob, age: new_customer_age, gender: new_customer_gender
            }, userId);
        }
    } catch (err) {
        console.error("Customer handling error:", err);
        return res.status(400).send(err.message || "Error processing customer information.");
    }

    // --- Secure & Hybrid Item Calculation ---
    const packageDetailsFromDb = db.prepare(`SELECT name, mrp, b2b_price FROM packages WHERE package_list_id = ? AND name IN (${package_names.map(() => '?').join(',')})`).all(package_list_id, ...package_names);
    const packageMap = new Map(packageDetailsFromDb.map(p => [p.name, { mrp: p.mrp, b2b_price: p.b2b_price }]));

    let totalMrp = 0;
    let subtotalAfterItemDiscounts = 0;
    const estimateItemsData = [];

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

        if (role === 'CLIENT') {
            if (!dbPackage) return res.status(400).send(`Item '${name}' not found in the assigned rate database.`);
            mrp = dbPackage.mrp;
            b2b_price = dbPackage.b2b_price ?? mrp;
        } else {
            if (dbPackage) {
                mrp = dbPackage.mrp;
                b2b_price = dbPackage.b2b_price ?? mrp;
            } else {
                mrp = parseFloat(mrps[i]) || 0;
                b2b_price = mrp;
            }
        }
        
        if (mrp <= 0) continue;

        totalMrp += mrp;
        subtotalAfterItemDiscounts += mrp * (1 - itemDiscountPerc / 100);
        estimateItemsData.push({ package_name: name, mrp: mrp, b2b_price: b2b_price, discount_percentage: itemDiscountPerc });
    }

    if (estimateItemsData.length === 0) {
        return res.status(400).send("No valid items were found to create an estimate.");
    }

    const finalAmount = subtotalAfterItemDiscounts; // No overall discount
    const createdAtISO = new Date().toISOString();

    // --- Database Transaction ---
    const saveEstimate = db.transaction(() => {
        const estimateSql = `INSERT INTO estimates (branch_id, user_id, customer_id, lab_id, estimate_date, referred_by, discount_percentage, amount_after_discount, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const estimateInfo = db.prepare(estimateSql).run(branchId, userId, finalCustomerId, lab_id, formatDateForDatabase(estimate_date), referred_by, 0, finalAmount, notes, createdAtISO);
        const newEstimateId = estimateInfo.lastInsertRowid;

        const itemSql = `INSERT INTO estimate_items (estimate_id, package_name, mrp, b2b_price, discount_percentage) VALUES (?, ?, ?, ?, ?)`;
        const itemStmt = db.prepare(itemSql);
        for (const item of estimateItemsData) {
            itemStmt.run(newEstimateId, item.package_name, item.mrp, item.b2b_price, item.discount_percentage);
        }
        return newEstimateId;
    });

    // --- Execute and Respond ---
    try {
        const newEstimateId = saveEstimate();
        console.log(`Estimate (ID: ${newEstimateId}) saved for Customer ID: ${finalCustomerId}`);
        res.redirect(`/estimate/${newEstimateId}`);
    } catch (err) {
        console.error(`Error saving estimate for Customer ${finalCustomerId}: ${err.message}`);
        res.status(403).send(`<h1>Operation Failed</h1><p><strong>Error:</strong> ${err.message}</p><a href="javascript:history.back()">Go Back</a>`);
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