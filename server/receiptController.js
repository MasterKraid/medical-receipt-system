// medical_receipt_system/server/receiptController.js
const db = require("./db");
// Import the date utility functions
const { formatDateForDatabase, formatDateForDisplay, formatTimestampForDisplayIST } = require('./utils/dateUtils');

// Show the receipt form
exports.showReceiptForm = (req, res) => {
    res.render("form_receipt", {}); // Pass empty object or necessary defaults
};

// Create and save a new receipt with items
exports.createReceipt = (req, res) => {
    if (!req.session.user) {
        return res.status(401).send("Unauthorized");
    }
    const userId = req.session.user.id;
    const branchId = req.session.user.branchId;

    const {
        customer_name,
        age,
        customer_dob, // Comes from flatpickr as DD/MM/YYYY
        gender,
        mobile_no,
        referred_by,
        discount_percentage,
        amount_received,
        num_tests,
        conducted_at,
        payment_method,
        notes,
        due_amount_manual, // Optional manual due amount
        package_names,
        mrps,
        item_discounts, // Item arrays
    } = req.body;

    // --- Validation ---
    if (!branchId || !userId) {
        console.error("Missing branchId or userId in session for receipt creation.");
        // Redirect to login or show error
        return res.redirect('/?error=session'); // Or render an error page
    }
    if (!customer_name || customer_name.trim() === '') {
        // Handle error - perhaps render form again with error message
        return res.status(400).send("Customer Name is required."); // Simple response for now
    }
    if (
        !Array.isArray(package_names) ||
        !Array.isArray(mrps) ||
        !Array.isArray(item_discounts) ||
        package_names.length === 0 ||
        package_names.length !== mrps.length ||
        package_names.length !== item_discounts.length
    ) {
        console.error("Invalid item data arrays received for receipt.");
        return res.status(400).send("Invalid item data.");
    }

    const customerAgeValue = age && age.trim() !== '' ? parseInt(age, 10) : null;
    // Format customer_dob (likely DD/MM/YYYY from form) to YYYY-MM-DD for DB
    const customerDobForDb = formatDateForDatabase(customer_dob);

    // Validate Age/DOB Requirement
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

    if (amount_received === undefined || amount_received === null || String(amount_received).trim() === '' || isNaN(parseFloat(amount_received))) {
        return res.status(400).send("Received Amount is required and must be a number.");
    }
    const amountReceivedValue = parseFloat(amount_received);
    if (amountReceivedValue < 0) {
        return res.status(400).send("Received Amount cannot be negative.");
    }

    const customerGenderValue = gender;
    const customerMobileValue = mobile_no;
    const numTestsValue = num_tests && String(num_tests).trim() !== '' ? parseInt(num_tests, 10) : null;
    if (numTestsValue !== null && (isNaN(numTestsValue) || numTestsValue < 0)) {
        return res.status(400).send("Invalid Number of Tests.");
    }
    const conductedAtValue = conducted_at;
    const paymentMethodValue = payment_method;
    const receiptNotes = notes;

    // --- Calculation ---
    let totalMrp = 0;
    let subtotalAfterItemDiscounts = 0;
    const receiptItemsData = [];

    for (let i = 0; i < package_names.length; i++) {
        const name = package_names[i] ? String(package_names[i]).trim() : "";
        const mrp = parseFloat(mrps[i]) || 0;
        const itemDiscountPerc = parseFloat(item_discounts[i]) || 0;

        if (!name || mrp <= 0) {
            console.warn(`Skipping invalid item at index ${i}: Name='${name}', MRP='${mrps[i]}'`);
            continue; // Skip
        }
        if (itemDiscountPerc < 0 || itemDiscountPerc > 100) {
            console.error(`Invalid item discount percentage ${itemDiscountPerc} for item ${name}.`);
            return res.status(400).send(`Invalid discount percentage for item: ${name}. Must be between 0 and 100.`);
        }

        totalMrp += mrp;
        const itemPriceAfterDiscount = mrp * (1 - itemDiscountPerc / 100);
        subtotalAfterItemDiscounts += itemPriceAfterDiscount;

        receiptItemsData.push({
            package_name: name,
            mrp: mrp,
            discount_percentage: itemDiscountPerc,
        });
    }

    if (receiptItemsData.length === 0) {
        return res.status(400).send("No valid items found in the receipt.");
    }

    const amountFinalValue = subtotalAfterItemDiscounts * (1 - overallDiscountPerc / 100);

    // Handle Due Amount
    let amountDueValue;
    const manualDueInput = due_amount_manual !== undefined ? String(due_amount_manual).trim() : "";
    const manualDue = parseFloat(manualDueInput);

    if (manualDueInput !== "" && !isNaN(manualDue) && manualDue >= 0) {
        amountDueValue = manualDue;
        const calculatedDue = Math.max(0, amountFinalValue - amountReceivedValue);
        if (Math.abs(manualDue - calculatedDue) > 0.01) {
            console.warn(`Manual due amount (${manualDue.toFixed(2)}) provided differs from calculated due (${calculatedDue.toFixed(2)})`);
        }
        console.log(`Using manual due: ${amountDueValue.toFixed(2)}`);
    } else {
        amountDueValue = Math.max(0, amountFinalValue - amountReceivedValue);
        console.log(`Calculated due: ${amountFinalValue.toFixed(2)} - ${amountReceivedValue.toFixed(2)} = ${amountDueValue.toFixed(2)}`);
    }

    // *** Get current timestamp in UTC ISO 8601 format ***
    const createdAtISO = new Date().toISOString(); // e.g., "2025-03-29T09:19:18.123Z"

    // --- Database Transaction ---
    const saveReceipt = db.transaction(() => {
        // *** ADD created_at to the INSERT statement ***
        const receiptStmt = db.prepare(
            `INSERT INTO receipts (
                branch_id, user_id, customer_name, customer_age, customer_dob,
                customer_gender, customer_mobile, referred_by, total_mrp, discount_percentage,
                amount_final, amount_received, amount_due, payment_method, num_tests,
                conducted_at, notes, created_at -- Added column
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, // Added placeholder
        );
        const receiptInfo = receiptStmt.run(
            branchId,
            userId,
            customer_name.trim(),
            customerAgeValue,
            customerDobForDb,
            customerGenderValue,
            customerMobileValue,
            referred_by,
            totalMrp,
            overallDiscountPerc,
            amountFinalValue,
            amountReceivedValue,
            amountDueValue,
            paymentMethodValue,
            numTestsValue !== null ? numTestsValue : receiptItemsData.length,
            conductedAtValue,
            receiptNotes,
            createdAtISO // *** Pass the ISO timestamp string ***
        );
        const newReceiptId = receiptInfo.lastInsertRowid;

        const itemStmt = db.prepare(
            `INSERT INTO receipt_items (receipt_id, package_name, mrp, discount_percentage)
             VALUES (?, ?, ?, ?)`
        );
        for (const item of receiptItemsData) {
            itemStmt.run(
                newReceiptId,
                item.package_name,
                item.mrp,
                item.discount_percentage,
            );
        }
        return newReceiptId;
    });

    // --- Execute and Respond ---
    try {
        const newReceiptId = saveReceipt();
        console.log(`Receipt (ID: ${newReceiptId}) saved successfully by User ID: ${userId} at ${createdAtISO}`);
        res.redirect(`/receipt/${newReceiptId}`);
    } catch (err) {
        console.error(`Error saving receipt for User ID ${userId}: ${err.message}`, err);
        res.status(500).send("An error occurred while saving the receipt. Please try again or contact support.");
    }
};


// Show a specific saved receipt with items
exports.showReceipt = (req, res) => {
    const receiptId = req.params.id;
    if (!receiptId || isNaN(parseInt(receiptId))) {
        return res.status(400).send("Invalid Receipt ID.");
    }

    try {
        const receiptStmt = db.prepare("SELECT * FROM receipts WHERE id = ?");
        const receiptData = receiptStmt.get(receiptId);

        if (!receiptData) {
            return res.status(404).send("Receipt not found.");
        }

        // Optional: Authorization check
        // if (req.session.user.branchId !== receiptData.branch_id && !req.session.user.isAdmin) { ... }

        const itemsStmt = db.prepare(
            "SELECT id, package_name, mrp, discount_percentage FROM receipt_items WHERE receipt_id = ? ORDER BY id"
        );
        const items = itemsStmt.all(receiptId);

        const branchStmt = db.prepare(
            "SELECT id, name, address, phone FROM branches WHERE id = ?"
        );
        const branchDetails = branchStmt.get(receiptData.branch_id);

        if (!branchDetails) {
            console.error(`Critical: Branch details not found for branch_id ${receiptData.branch_id} associated with receipt ${receiptId}.`);
            return res.status(500).send("An internal error occurred retrieving branch information.");
        }

        // --- Data Formatting and Recalculation for Display Consistency ---
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

        receiptData.totalMrpFormatted = (receiptData.total_mrp !== null ? parseFloat(receiptData.total_mrp) : calculatedTotalMrp).toFixed(2);
        receiptData.subtotalAfterItemDiscountsFormatted = calculatedSubtotalAfterItemDiscounts.toFixed(2);

        const overallDiscPerc = parseFloat(receiptData.discount_percentage) || 0;
        receiptData.overallDiscountPercentageFormatted = overallDiscPerc.toFixed(1);

        const calculatedOverallDiscountAmount = calculatedSubtotalAfterItemDiscounts * (overallDiscPerc / 100);
        receiptData.overallDiscountAmountFormatted = calculatedOverallDiscountAmount.toFixed(2);

        const dbFinalAmount = parseFloat(receiptData.amount_final) || 0;
        receiptData.finalAmountFormatted = dbFinalAmount.toFixed(2);

        receiptData.amountReceivedFormatted = (parseFloat(receiptData.amount_received) || 0).toFixed(2);
        receiptData.amountDueFormatted = (parseFloat(receiptData.amount_due) || 0).toFixed(2);

        // --- Date/Time Formatting ---
        // Use the utility function to format the creation timestamp (now ISO string from DB) to IST
        receiptData.displayReceiptDate = formatTimestampForDisplayIST(receiptData.created_at);
        receiptData.displayCustomerDob = formatDateForDisplay(receiptData.customer_dob);

        // --- Render the View ---
        res.render("receipt", {
            receiptData: receiptData,
            items: items,
            branchDetails: branchDetails
        });

    } catch (err) {
        console.error(`Error fetching receipt ID ${receiptId}: ${err.message}`, err);
        res.status(500).send("An internal server error occurred.");
    }
};