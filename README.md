# 🩺 Treat & Cure - Medical Receipt System

![Node.js](https://img.shields.io/badge/Node.js-14.x%2B-green?style=flat-square&logo=node.js)
![Express.js](https://img.shields.io/badge/Express.js-4.x-blue?style=flat-square&logo=express)
![SQLite](https://img.shields.io/badge/SQLite-3.x-blue?style=flat-square&logo=sqlite)
![EJS](https://img.shields.io/badge/EJS-Template-red?style=flat-square)

A web application designed for clinics or diagnostic centers (like "Treat & Cure") to efficiently generate, manage, and print cost estimates and final payment receipts for medical tests and packages.

## ✨ Features

*   **User Authentication:** Secure login system for staff.
*   **Estimate Generation:**
    *   Create detailed cost estimates for patients.
    *   Add multiple tests/packages dynamically.
    *   Apply discounts per item and an overall discount.
    *   Live preview of calculations (MRP, Subtotal, Discount Amount, Final Estimate).
    *   Save and view past estimates.
    *   Printable estimate format.
*   **Receipt Generation:**
    *   Create final money receipts based on tests performed.
    *   Includes fields for patient details, referred doctor, payment details (received, due), payment method, etc.
    *   Supports item-specific and overall discounts.
    *   Live preview of calculations (MRP, Subtotal, Discount Amount, Net Payable, Due).
    *   Handles IST (GMT+5:30) timestamp display for receipt creation time.
    *   Save and view past receipts.
    *   Printable receipt format.
*   **Package Management:** Basic API endpoint (`/api/packages`) to fetch available tests/packages for forms.
*   **Branch Awareness:** Associates users and potentially receipts/estimates with specific branches (requires branch data).
*   **Admin Dashboard:** A basic dashboard for administrators (further development planned).
*   **Data Persistence:** Uses SQLite for storing user, branch, package, estimate, and receipt data.

## 💻 Tech Stack

*   **Backend:** Node.js, Express.js
*   **Templating:** EJS (Embedded JavaScript templates)
*   **Database:** SQLite 3 with `better-sqlite3` driver
*   **Authentication:** `express-session`, `bcrypt` (for password hashing)
*   **Frontend:** HTML, CSS, Vanilla JavaScript, Flatpickr (for date selection)
*   **Utilities:** `body-parser`


## 🚀 Getting Started

### Prerequisites

*   Node.js (v14.x or later recommended)
*   npm (usually comes with Node.js)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/MasterKraid/medical-receipt-system
    cd medical_receipt_system
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Running the Application

1.  **Start the server:**
    ```bash
    node server/app.js
    ```

2.  The application should now be running at `http://localhost:3000`.

## 🔧 Usage

1.  **Login:**
    *   Navigate to `http://localhost:3000`.
    *   Use the default credentials (created by `server/db.js` if the database is new):
        *   **Admin:** Username: `admin`, Password: `password`
        *   **Regular User:** Username: `testuser`, Password: `test`
        *   Change them while in use.
2.  **Create Estimate:**
    *   Log in as any user.
    *   Navigate to `/estimate-form`.
    *   Fill in patient details and the date the estimate is for.
    *   Add tests/packages using the dynamic item rows. Select from the dropdown or type manually (MRP will auto-fill if selected).
    *   Enter item-specific discounts (%) if applicable.
    *   Enter an overall discount (%) if applicable.
    *   Observe the live calculation preview.
    *   Add any notes.
    *   Click "Generate Estimate". You will be redirected to the estimate view.
3.  **Create Receipt:**
    *   Log in as any user.
    *   Navigate to `/receipt-form`.
    *   Fill in patient details.
    *   Add tests/packages performed.
    *   Enter item/overall discounts.
    *   Enter the "Received Amount".
    *   Optionally override the "Due Amount".
    *   Fill in other details like Payment Method, Conducted At, etc.
    *   Observe the live calculation preview.
    *   Click "Generate & Save Receipt". You will be redirected to the receipt view.
4.  **View/Print:**
    *   After creating an estimate or receipt, you'll be on its dedicated view page (`/estimate/:id` or `/receipt/:id`).
    *   Use the "Print" button to get a print-friendly version.
    *   Use the "New Form" button to return to the creation form.

## 💾 Database

*   The application uses **SQLite** for data storage.
*   The database file is located at `data/database.sqlite`.
*   The schema (table structure) is defined and created automatically on first run by `server/db.js`.
*   `server/db.js` also handles initial data seeding (default branch, admin user, test user, sample packages) if the tables are empty.
*   Timestamps (`created_at`) for estimates and receipts are stored in UTC (ISO 8601 format).

## 🌐 API Endpoints

*   **`GET /api/packages`**
    *   **Description:** Retrieves a list of all available packages/tests.
    *   **Authentication:** Required (user must be logged in).
    *   **Response:** JSON array of package objects: `[{ id: number, name: string, mrp: number }, ...]`.

## 🔮 Future Enhancements / TODO

*   **Full Admin CRUD:** Implement interfaces for admins to manage Branches, Users, and Packages directly through the web interface.
*   **Reporting:** Generate summary reports (e.g., daily/monthly collections, tests performed).
*   **Search & Filtering:** Add functionality to search/filter existing estimates and receipts.
*   **Security Hardening:**
    *   Implement proper environment variable management for secrets (session secret, database paths).
    *   Implement CSRF protection.
    *   More robust input validation and sanitization.
    *   Use asynchronous password hashing (`bcrypt.hash`, `bcrypt.compare`).
*   **Refactoring:** Abstract calculation logic into shared utilities. Improve error handling consistency.
*   **UI/UX Improvements:** Enhance styling, add loading indicators, better error feedback.
*   **Testing:** Add unit and integration tests.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
