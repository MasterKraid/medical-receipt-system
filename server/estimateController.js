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
    if (!req.session.user) { return res.status(401).send("Unauthorized"); }
    const { id: userId, branchId, role } = req.session.user;

    const {
        customer_id, new_customer_name, new_customer_mobile, new_customer_dob, new_customer_age, new_customer_gender,
        estimate_date, referred_by, discount_percentage, notes,
        package_names, mrps, item_discounts,
    } = req.body;

    // Server-side check for duplicate tests
    if (package_names && new Set(package_names).size !== package_names.length) {
        return res.status(400).send("Duplicate tests are not allowed in the same estimate.");
    }
    
    // ... (keep the validation blocks from your existing code)

    // --- Customer Handling ---
    let finalCustomerId;
    try {
        if (customer_id && /^\d+$/.test(customer_id)) {
            // ... (existing logic)
        } else {
            finalCustomerId = findOrCreateCustomer({
                name: new_customer_name, mobile: new_customer_mobile, dob: new_customer_dob, age: new_customer_age, gender: new_customer_gender
            }, userId);
        }
    } catch (err) {
        console.error("Customer handling error:", err);
        return res.status(400).send(err.message || "Error processing customer information.");
    }

    // --- Item Calculation ---
    const estimateItemsData = [];
    let totalB2BPrice = 0; // For client wallet deduction
    // Use the prices submitted from the form, which JS has already set correctly (MRP for normal, B2B for client)
    for (let i = 0; i < package_names.length; i++) {
        const name = package_names[i] ? String(package_names[i]).trim() : "";
        const price = parseFloat(mrps[i]) || 0; // The 'mrp' input now holds the relevant price
        if (!name || price <= 0) continue;
        
        estimateItemsData.push({ package_name: name, price: price });
        totalB2BPrice += price; // For clients, this is the total B2B price. For others, it doesn't matter yet.
    }
    if (estimateItemsData.length === 0) { return res.status(400).send("No valid items found."); }
    const createdAtISO = new Date().toISOString();


    // --- Database Transaction ---
    const saveEstimate = db.transaction(() => {
        // --- VIRTUAL WALLET CHECK (CLIENTS ONLY) ---
        if (role === 'CLIENT') {
            const client = db.prepare("SELECT wallet_balance, allow_negative_balance, negative_balance_allowed_until FROM users WHERE id = ?").get(userId);
            
            if (totalB2BPrice > client.wallet_balance) {
                const now = new Date();
                const allowedUntil = client.negative_balance_allowed_until ? new Date(client.negative_balance_allowed_until) : null;
                
                // Check if negative balance is allowed and if the time limit has not expired
                if (!client.allow_negative_balance || !allowedUntil || now > allowedUntil) {
                    // This will rollback the transaction
                    throw new Error(`Insufficient wallet balance. Required: ${totalB2BPrice.toFixed(2)}, Available: ${client.wallet_balance.toFixed(2)}.`);
                }
            }
            // If check passes, deduct from wallet
            db.prepare("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?").run(totalB2BPrice, userId);
            console.log(`Deducted ${totalB2BPrice} from wallet of Client ID ${userId}.`);
        }

        const estimateSql = `INSERT INTO estimates (branch_id, user_id, customer_id, estimate_date, referred_by, discount_percentage, amount_after_discount, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const estimateInfo = db.prepare(estimateSql).run(branchId, userId, finalCustomerId, formatDateForDatabase(estimate_date), referred_by, 0, totalB2BPrice, notes, createdAtISO);
        const newEstimateId = estimateInfo.lastInsertRowid;

        const itemSql = `INSERT INTO estimate_items (estimate_id, package_name, mrp, b2b_price, discount_percentage) VALUES (?, ?, ?, ?, ?)`;
        const itemStmt = db.prepare(itemSql);
        for (const item of estimateItemsData) {
            // For clients, mrp and b2b_price are the same. For others, b2b is 0 for now.
            const mrp = role === 'CLIENT' ? item.price : item.price;
            const b2b = role === 'CLIENT' ? item.price : 0;
            itemStmt.run(newEstimateId, item.package_name, mrp, b2b, 0);
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
        // Send a user-friendly error page or message
        res.status(403).send(`
            <h1>Operation Failed</h1>
            <p><strong>Error:</strong> ${err.message}</p>
            <a href="javascript:history.back()">Go Back</a>
        `);
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