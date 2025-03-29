// medical_receipt_system/server/estimateController.js
const db = require("./db");
// Import the date utility functions
const { formatDateForDatabase, formatDateForDisplay } = require('./utils/dateUtils'); // No timestamp needed for estimate display usually

// Show form
exports.showEstimateForm = (req, res) => {
    res.render("form_estimate", {}); // Pass empty object or necessary defaults
};

// Create estimate
exports.createEstimate = (req, res) => {
    if (!req.session.user) {
        return res.status(401).send("Unauthorized");
    }
    const userId = req.session.user.id;
    const branchId = req.session.user.branchId;
    const {
        estimate_date, // Comes from flatpickr as DD/MM/YYYY
        customer_name,
        age,
        customer_dob, // Comes from flatpickr as DD/MM/YYYY
        gender,
        mobile_no,
        referred_by,
        discount_percentage,
        notes,
        package_names,
        mrps,
        item_discounts,
    } = req.body;

    // --- Validation ---
    if (!branchId || !userId) {
        console.error("Missing branchId or userId in session for estimate creation.");
        return res.redirect('/?error=session');
    }

    const estimateDateForDb = formatDateForDatabase(estimate_date);
    if (!estimateDateForDb) {
        console.error("Invalid or missing estimate_date:", estimate_date);
        return res.status(400).send("Valid Estimate Date is required.");
    }
    if (
        !Array.isArray(package_names) ||
        !Array.isArray(mrps) ||
        !Array.isArray(item_discounts) ||
        package_names.length === 0 ||
        package_names.length !== mrps.length ||
        package_names.length !== item_discounts.length
    ) {
        console.error("Invalid item data arrays received for estimate.");
        return res.status(400).send("Invalid item data.");
    }

    const customerAgeValue = age && age.trim() !== '' ? parseInt(age, 10) : null;
    const customerDobForDb = formatDateForDatabase(customer_dob);

    if (customerAgeValue === null && customerDobForDb === null) {
        return res.status(400).send("Either Customer Age or a valid Date of Birth is required.");
    }
    if (age && age.trim() !== '' && (isNaN(customerAgeValue) || customerAgeValue < 0 || customerAgeValue > 130)) {
        return res.status(400).send("Invalid Age provided.");
    }

    const overallDiscountPerc = parseFloat(discount_percentage) || 0;
    if (overallDiscountPerc < 0 || overallDiscountPerc > 100) {
        return res.status(400).send("Invalid Overall Discount percentage (must be 0-100).");
    }
    const customerGenderValue = gender;
    const customerMobileValue = mobile_no;
    const customerReferredBy = referred_by;
    const estimateNotes = notes;

    // --- Calculation ---
    let totalMrp = 0;
    let subtotalAfterItemDiscounts = 0;
    const estimateItemsData = [];

    for (let i = 0; i < package_names.length; i++) {
        const name = package_names[i] ? String(package_names[i]).trim() : "";
        const mrp = parseFloat(mrps[i]) || 0;
        const itemDiscountPerc = parseFloat(item_discounts[i]) || 0;

        if (!name || mrp <= 0) {
            console.warn(`Skipping invalid item at index ${i}: Name='${name}', MRP='${mrps[i]}'`);
            continue;
        }
        if (itemDiscountPerc < 0 || itemDiscountPerc > 100) {
            console.error(`Invalid item discount percentage ${itemDiscountPerc} for item ${name}.`);
            return res.status(400).send(`Invalid discount percentage for item: ${name}. Must be between 0 and 100.`);
        }

        totalMrp += mrp;
        const itemPriceAfterDiscount = mrp * (1 - itemDiscountPerc / 100);
        subtotalAfterItemDiscounts += itemPriceAfterDiscount;

        estimateItemsData.push({
            package_name: name,
            mrp: mrp,
            discount_percentage: itemDiscountPerc,
        });
    }

    if (estimateItemsData.length === 0) {
        return res.status(400).send("No valid items found in the estimate.");
    }

    const finalAmount = subtotalAfterItemDiscounts * (1 - overallDiscountPerc / 100);

    // *** Get current timestamp in UTC ISO 8601 format ***
    const createdAtISO = new Date().toISOString();

    // --- Database Transaction ---
    const saveEstimate = db.transaction(() => {
        // *** ADD created_at to the INSERT statement ***
        const estimateStmt = db.prepare(
            `INSERT INTO estimates (
                branch_id, user_id, estimate_date, customer_name, customer_age,
                customer_dob, customer_gender, customer_mobile, referred_by,
                discount_percentage, amount_after_discount, notes, created_at -- Added column
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, // Added placeholder
        );
        const estimateInfo = estimateStmt.run(
            branchId,
            userId,
            estimateDateForDb,
            customer_name,
            customerAgeValue,
            customerDobForDb,
            customerGenderValue,
            customerMobileValue,
            customerReferredBy,
            overallDiscountPerc,
            finalAmount,
            estimateNotes,
            createdAtISO // *** Pass the ISO timestamp string ***
        );
        const newEstimateId = estimateInfo.lastInsertRowid;

        const itemStmt = db.prepare(
            `INSERT INTO estimate_items (estimate_id, package_name, mrp, discount_percentage)
            VALUES (?, ?, ?, ?)`
        );
        for (const item of estimateItemsData) {
            itemStmt.run(
                newEstimateId,
                item.package_name,
                item.mrp,
                item.discount_percentage,
            );
        }
        return newEstimateId;
    });

    // --- Execute and Respond ---
    try {
        const newEstimateId = saveEstimate();
        console.log(`Estimate (ID: ${newEstimateId}) saved successfully by User ID: ${userId} at ${createdAtISO}`);
        res.redirect(`/estimate/${newEstimateId}`);
    } catch (err) {
        console.error(`Error saving estimate for User ID ${userId}: ${err.message}`, err);
        res.status(500).send("An error occurred while saving the estimate. Please try again or contact support.");
    }
};


// Show estimate
exports.showEstimate = (req, res) => {
    const estimateId = req.params.id;
    if (!estimateId || isNaN(parseInt(estimateId))) {
        return res.status(400).send("Invalid Estimate ID.");
    }

    try {
        const estimateData = db
            .prepare("SELECT * FROM estimates WHERE id = ?")
            .get(estimateId);

        if (!estimateData) {
            return res.status(404).send("Estimate not found.");
        }

        // Optional: Authorization check
        // if (req.session.user.branchId !== estimateData.branch_id && !req.session.user.isAdmin) { ... }

        const items = db
            .prepare("SELECT * FROM estimate_items WHERE estimate_id = ? ORDER BY id")
            .all(estimateId);

        const branchDetails = db
            .prepare("SELECT id, name, address, phone FROM branches WHERE id = ?")
            .get(estimateData.branch_id);

        if (!branchDetails) {
            console.error(`Critical: Branch details not found for branch_id ${estimateData.branch_id} associated with estimate ${estimateId}.`);
            return res.status(500).send("An internal error occurred retrieving branch information.");
        }

        // --- Data Formatting and Calculation for Display ---
        let calculatedTotalMrp = 0;
        let calculatedSubtotalAfterItemDiscounts = 0;

        items.forEach((item) => {
            const itemMrp = parseFloat(item.mrp) || 0;
            const itemDiscPerc = parseFloat(item.discount_percentage) || 0;
            item.mrpFormatted = itemMrp.toFixed(2);
            item.discountPercentageFormatted = itemDiscPerc.toFixed(1);
            item.priceAfterItemDiscount = itemMrp * (1 - itemDiscPerc / 100);
            item.priceAfterItemDiscountFormatted = item.priceAfterItemDiscount.toFixed(2);
            calculatedTotalMrp += itemMrp;
            calculatedSubtotalAfterItemDiscounts += item.priceAfterItemDiscount;
        });

        estimateData.totalMrpFormatted = calculatedTotalMrp.toFixed(2);
        estimateData.subtotalAfterItemDiscountsFormatted = calculatedSubtotalAfterItemDiscounts.toFixed(2);

        const overallDiscPerc = parseFloat(estimateData.discount_percentage) || 0;
        estimateData.overallDiscountPercentageFormatted = overallDiscPerc.toFixed(1);

        const calculatedOverallDiscountAmount = calculatedSubtotalAfterItemDiscounts * (overallDiscPerc / 100);
        estimateData.overallDiscountAmountFormatted = calculatedOverallDiscountAmount.toFixed(2);

        const dbFinalAmount = parseFloat(estimateData.amount_after_discount) || 0;
        estimateData.finalAmountFormatted = dbFinalAmount.toFixed(2);

        // --- Date Formatting ---
        // Format the estimate_date (date estimate is *for*)
        estimateData.displayEstimateDate = formatDateForDisplay(estimateData.estimate_date);
        // Format the customer DOB
        estimateData.displayCustomerDob = formatDateForDisplay(estimateData.customer_dob);
        // NOTE: We don't usually display the 'created_at' timestamp on the estimate itself, just the date it's for.

        res.render("estimate", {
            estimateData: estimateData,
            items: items,
            branchDetails: branchDetails
        });

    } catch (err) {
        console.error(`Error fetching estimate ID ${estimateId}: ${err.message}`, err);
        res.status(500).send("An internal server error occurred.");
    }
};