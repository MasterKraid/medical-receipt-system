# Project LISP <i className="fa-solid fa-notes-medical" style="color: #4A90E2;"></i>

<div align="center">
  <img src="client/public/company-logo.png" alt="Project LISP Logo" height="200" />
</div>

<p align="center">
  <img src="https://img.shields.io/badge/Status-BETA_V9-orange?style=flat-square&logo=font-awesome&logoColor=white" alt="BETA V9 Badge" />
  <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square" alt="Apache 2.0 License" />
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-Frontend-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
</p>

## Overview <i className="fa-solid fa-stethoscope" style="color: #4A90E2;"></i>

**Project LISP** is a comprehensive, full-stack laboratory information management and billing system(LIMS). Designed specifically for diagnostic centers, franchise labs, and medical administrative teams, it completely modernizes how medical receipts, patient estimates, B2B price tracking, and multi-branch client portfolios are managed.

It replaces fragmented spreadsheet workflows with a clean, centralized, and highly secure cloud-based dashboard accessible for administrators, general employees, and B2B tracking clients alike.

---

## Key Capabilities <i className="fa-solid fa-layer-group" style="color: #4A90E2;"></i>

### 💼 Smart Billing & Estimations
- **Dynamic Receipt Generation:** Create highly customized receipts and quotations with instant PDF generation using specialized templates. It automatically tracks received amounts, due payments, and tracks referring doctors.
- **B2B vs B2C Price Matrix:** Effortlessly distinguish between Maximum Retail Price (MRP) and B2B pricing models within your rate lists. The intelligent search system calculates total profits transparently for admin-level users.
- **Estimate Comparison Sheet:** Generate real-time cost comparisons for patient test regimens across multiple major laboratories without ever leaving the system.

### 👥 Comprehensive Role Management
Project LISP supports robust Role-Based Access Control (RBAC):
- **Administrators:** Have unfettered access to all financial analytics, package lists, branches, wallet limits, and user provisioning.
- **General Employees:** Facilitate front-desk operations by accessing estimate sheets and creating receipts, optionally bolstered by "Master Data Entry" tags to act on behalf of specific branches/clients.
- **Clients (B2B Partners):** Access a simplified dashboard to review their history, download their specific lab reports, and manage individual wallet ledgers.

### 🛡 "Acting As" Proxy Feature
A built-in capability for organizational overhead management. Support staff can seamlessly "Act As" a specific B2B client. When engaged, all searches and rate lists instantly filter to reflect only the permissions and contractual rates assigned to that specific client—ensuring absolute data isolation and zero pricing errors.

### 💰 Wallet & Ledger Tracking
Automatically sync every receipt generated into an immutable transaction ledger. You can establish "Negative Balance Allowances" for trusted partners with hard cut-off dates, providing a built-in line of credit management.

### 📊 Excel Integration & Mass Import
Rate list updates shouldn't require manual data entry. Project LISP features dedicated bulk Excel importers for updating lab package lists and comparison prices within seconds.

---

## Visual Tour <i className="fa-solid fa-images" style="color: #4A90E2;"></i>

> **[ PLACEHOLDER: Insert Screenshot of the Login Screen Here ]**
> *The secure entry point for all Project LISP users.*

> **[ PLACEHOLDER: Insert Screenshot of the Admin Dashboard Here ]**
> *The Administrator interface providing a high-level view of all system operations.*

> **[ PLACEHOLDER: Insert Screenshot of the Receipt Generation Form Here ]**
> *A dynamic cart-style interface for assembling test regimens and calculating net payables.*

> **[ PLACEHOLDER: Insert Screenshot of the Comparison Data Editor Here ]**
> *The mass-editor that manages inter-laboratory price matrices.*

---

## Technical Architecture <i className="fa-solid fa-server" style="color: #4A90E2;"></i>

- **Frontend:** Built with React 18, Vite, and Tailwind CSS for rapid scaling and a profoundly responsive mobile-first UI. Includes PWA capabilities via `vite-plugin-pwa`.
- **Backend:** Powered by Express.js (Node.js) acting as a secure REST API processing engine.
- **Database:** Utilizing `better-sqlite3` for an incredibly fast, localized relational data store equipped with pragmas optimally tuned for high concurrency.
- **Security Protocols:** Features BCrypt hash integration, strict rate-limiting endpoints, HTTPOnly cookie session management, and robust NGINX configurations for safe local networking.

---

## Installation & Deployment <i className="fa-solid fa-rocket" style="color: #4A90E2;"></i>

This system requires Node.js (v18+) and npm.

```bash
# Clone the repository
git clone <repository-url>
cd medical-receipt-system

# Use the comprehensive install script to setup both environments
npm run postinstall

# For Development execution:
npm run dev

# For Production build and execution:
npm start
```

---

## License & Credits <i className="fa-solid fa-scale-balanced" style="color: #4A90E2;"></i>

This software is licensed under the **Apache License 2.0**. You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0).

### Open Source Acknowledgments

This project wouldn't be possible without the extensive open-source community. Special thanks to:

*   **[React](https://reactjs.org/)** & **[Vite](https://vitejs.dev/)** for providing a blazing fast development cycle.
*   **[Tailwind CSS](https://tailwindcss.com/)** for the utility-first CSS framework defining our UI.
*   **[Express](https://expressjs.com/)** for scalable backend infrastructure.
*   **[Better-SQLite3](https://github.com/WiseLibs/better-sqlite3)** for the fastest and simplest SQLite3 library for Node.js.
*   **[ExcelJS](https://github.com/exceljs/exceljs)** for making mass data uploading reliable and robust.
*   **[Bcrypt](https://www.npmjs.com/package/bcrypt)** & **[Express-Rate-Limit](https://www.npmjs.com/package/express-rate-limit)** safeguarding the ecosystem.

<br />
<p align="right">
  <strong>Studio Kivix</strong><br />
  <em>Created By Tathagata S.</em>
</p>
