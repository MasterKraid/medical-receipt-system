const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const authController = require('./authController');
const receiptController = require('./receiptController');

const app = express();


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));


app.use(express.static(path.join(__dirname, '..', 'public')));


app.get('/form.html', (req, res) => {
    const branch = req.session.branch || "Unknown Branch";

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt Form</title>
        <link rel="stylesheet" href="/styles.css">
        <script src="/script.js" defer></script>
    </head>
    <body>
        <form id="receipt-form" action="/generate-receipt" method="POST">
            <h1>Receipt Form</h1>
            
            <label for="customer-name">Customer Name:</label>
            <input type="text" id="customer-name" name="customerName" required>

            <label for="fee-category">Fee Category:</label>
            <select id="fee-category" name="feeCategory">
                <option value="consultation">Consultation</option>
                <option value="medicines">Medicines</option>
                <option value="other">Other</option>
            </select>

            <label for="fee-amount">Fee Amount:</label>
            <input type="number" id="fee-amount" name="feeAmount" required>

            <label for="branch-location">Branch:</label>
            \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\x00
            <input type="text" id="branch-location" name="branch" readonly value="${branch}">

            <button type="submit">Preview & Print</button>
        </form>
    </body>
    </html>
    `);
});


app.post('/generate-receipt', (req, res) => {
    const { customerName, feeCategory, feeAmount, branch } = req.body;

    req.session.receiptData = {
        customerName,
        feeCategory,
        feeAmount,
        branch,
        date: new Date().toLocaleDateString()
    };

    res.redirect('/receipt');
});


app.get('/receipt', (req, res) => {
    const { customerName, feeCategory, feeAmount, branch, date } = req.session.receiptData || {};

    if (!customerName) {
        return res.status(400).send('No receipt data available');
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt</title>
        <link rel="stylesheet" href="/receipt.css">
    </head>
    <body onload="window.print(); window.onafterprint = window.close();">
        <div class="receipt-container">
            <header>
                <img src="/logo.png" alt="Shop Logo" class="logo">
                <h1>Medical Shop</h1>
                <p>Branch: ${branch}</p>
            </header>

            <section class="customer-details">
                <p><strong>Customer Name:</strong> ${customerName}</p>
                <p><strong>Date:</strong> ${date}</p>
            </section>

            <section class="fee-details">
                <h3>Fees Breakdown:</h3>
                <ul>
                    <li><strong>Fee Category:</strong> ${feeCategory}</li>
                    <li><strong>Fee Amount:</strong> ₹${feeAmount}</li>
                </ul>
            </section>

            <footer>
                <p>Thank you for visiting! We hope to serve you again.</p>
            </footer>
        </div>
    </body>
    </html>
    `);
});


app.post('/login', authController.login);


app.post('/save-receipt', receiptController.saveReceipt);

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
