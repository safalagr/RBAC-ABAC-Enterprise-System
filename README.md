# 🛡️ Enterprise-Grade RBAC & ABAC Access Control System
### *Hierarchical Roles (NIST RBAC1) • Attribute-Based Policies (NIST SP 800-162) • 4-Eyes Dual-Control (AC-5) • Cryptographic SHA-256 Audit Ledger*

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.18-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Security Standard](https://img.shields.io/badge/NIST-RBAC1%20%7C%20SP%20800--162%20%7C%20AC--5-0A85EA)](https://csrc.nist.gov/)

An advanced, production-grade enterprise authorization platform built for **Building Enterprise Applications (BEA)**. It demonstrates state-of-the-art access governance by combining **Hierarchical RBAC**, dynamic **Attribute-Based Access Control (ABAC)**, **4-Eyes Dual-Control (Maker-Checker)** workflows, and a **blockchain-style cryptographically chained SHA-256 audit ledger** with real-time tamper detection.

---

## 📑 Table of Contents
1. [Key Enterprise Architecture Highlights](#-key-enterprise-architecture-highlights)
2. [System Architecture](#-system-architecture)
3. [Enterprise Personas & Test Credentials](#-enterprise-personas--test-credentials)
4. [Core Modules & Capabilities](#-core-modules--capabilities)
   - [1. Hierarchical RBAC (NIST RBAC1)](#1-hierarchical-rbac-nist-rbac1)
   - [2. Attribute-Based Access Control (NIST SP 800-162 ABAC)](#2-attribute-based-access-control-nist-sp-800-162-abac)
   - [3. 4-Eyes Dual-Control Workflow (NIST SP 800-53 AC-5)](#3-4-eyes-dual-control-workflow-nist-sp-800-53-ac-5)
   - [4. Cryptographic Tamper-Evident Audit Ledger](#4-cryptographic-tamper-evident-audit-ledger)
   - [5. Interactive 2D Role-Permission Matrix](#5-interactive-2d-role-permission-matrix)
5. [Tech Stack](#-tech-stack)
6. [Repository Structure](#-repository-structure)
7. [Getting Started & Installation](#-getting-started--installation)
8. [Automated Test Suites](#-automated-test-suites)
9. [How to Push to GitHub](#-how-to-push-to-github)
10. [Course Evaluation & Academic Standards](#-course-evaluation--academic-standards)

---

## 🌟 Key Enterprise Architecture Highlights

* **NIST RBAC1 (Hierarchical Role Inheritance):** Solves role explosion via directed acyclic graph (DAG) inheritance (`Admin` $\rightarrow$ `Manager` $\rightarrow$ `Employee`). High-level roles automatically inherit base capabilities with cycle detection.
* **NIST SP 800-162 (ABAC Engine):** Decoupled **PDP (Policy Decision Point)** and **PEP (Policy Enforcement Point)** evaluating Subject Attributes (`department`, `clearanceLevel`, `maxRoleLevel`), Resource Attributes (`classification`, `minClearanceLevel`, `ownerId`), and environmental boundaries.
* **4-Eyes Dual-Control / Maker-Checker (NIST SP 800-53 AC-5):** High-impact enterprise operations (role elevations, security clearance upgrades, document releases, account decommissions) require independent verification. Strictly enforces **Anti-Self-Approval** ($\text{requesterId} \neq \text{reviewerId}$).
* **Cryptographic Tamper-Evident Audit Trail:** Every sensitive operation is anchored into a blockchain-style SHA-256 cryptographic chain ($Hash_n = \text{SHA-256}(Hash_{n-1} + \dots)$). Features an interactive **Tamper Simulator** and an automated **Ledger Repair & Recovery** engine.
* **Interactive 2D Access Matrix:** Real-time visual matrix showing direct permissions (`✓ Direct`) alongside inherited permissions (`↳ via Role`), with single-click dynamic toggling and synchronized column alignment.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT TIER (React 18 + Vite)                         │
│  • 2D Role-Permission Matrix    • ABAC Classified Documents                     │
│  • 4-Eyes Maker-Checker Queue   • Tamper-Evident Audit Ledger                   │
│  • Persona Quick-Switcher       • Responsive Clearance & Dept Badges            │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ REST API + Bearer JWT
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY & MIDDLEWARE TIER                          │
│  ┌─────────────────────────┐   ┌────────────────────────┐   ┌─────────────────┐ │
│  │ authenticate (JWT + DAG)│   │ authorize (Permissions)│   │ PEP Policy Gate │ │
│  └─────────────────────────┘   └────────────────────────┘   └─────────────────┘ │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
┌─────────────────────────────────┐             ┌─────────────────────────────────┐
│     ABAC DECISION ENGINE (PDP)  │             │   4-EYES GOVERNANCE ENGINE      │
│  • Department Scoping           │             │  • Anti-Self-Approval (AC-5)    │
│  • Clearance Level Matching     │             │  • Domain Role Scoping          │
│  • Hierarchy Dominance Checks   │             │  • Atomic Payload Execution     │
└────────────────┬────────────────┘             └────────────────┬────────────────┘
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                 CRYPTOGRAPHIC AUDIT ENGINE (SHA-256 BLOCKCHAIN)                 │
│         Hash_n = SHA-256(Hash_{n-1} + User + Action + Status + Nonce)           │
│        • Live Integrity Verification   • Fraud & Tamper Detection Engine         │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       PERSISTENCE LAYER (SQLite + Sequelize)                   │
│   Users • Roles • Permissions • Documents • ApprovalRequests • AuditLogs (Ledger)│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 👥 Enterprise Personas & Test Credentials

The database seeds with ready-to-test personas across functional departments and clearance ranks:

| Persona | Username | Password | Role (Hierarchy Level) | Department | Clearance Level | Key Capabilities & Inheritance |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **CISO / Executive Admin** | `admin` | `Admin@123` | **Admin** (Level 100) | IT | **Level 3** (Top Secret) | Full system governance, Checker authority over all categories, inherits Manager + Employee permissions. |
| **Engineering Director** | `manager` | `Manager@123` | **Manager** (Level 50) | Engineering | **Level 2** (Confidential) | Department document approvals, audit viewing, inherits Employee permissions. |
| **Senior HR Specialist** | `hruser` | `HR@123` | **HR** (Level 40) | HR | **Level 2** (Confidential) | User provisioning, clearance upgrade approvals, inherits Employee permissions. |
| **Finance Manager** | `finance_user` | `Finance@123` | **Manager** (Level 50) | Finance | **Level 2** (Confidential) | Financial document oversight, department scoping. |
| **Software Engineer** | `employee` | `Employee@123` | **Employee** (Level 10) | Engineering | **Level 1** (Public / Internal) | Standard user, Maker-only (can submit elevation requests, cannot act as Checker). |

> **💡 Quick Login Tip:** The Login UI features **1-Click Persona Buttons** at the bottom to prefill credentials instantly!

---

## 🚀 Core Modules & Capabilities

### 1. Hierarchical RBAC (NIST RBAC1)
* Roles are organized in an inheritance tree with self-referencing `parentRoleId`.
* [backend/utils/hierarchyResolver.js](backend/utils/hierarchyResolver.js) recursively traverses parent roles to collect effective permissions transitively.
* Eliminates duplicate permission assignments. Higher-tier roles automatically gain base capabilities.
* Role modification routes include **cycle detection** preventing circular inheritance deadlocks.

### 2. Attribute-Based Access Control (NIST SP 800-162 ABAC)
* Access decisions evaluate four attribute vectors:
  1. **Subject Attributes:** `department`, `clearanceLevel`, `maxRoleLevel`.
  2. **Resource Attributes:** `department`, `classification` (`public`, `internal`, `confidential`, `restricted`), `minClearanceLevel`, `ownerId`.
  3. **Action:** `read`, `create`, `update`, `delete`, `publish`.
  4. **Environmental Context:** Department isolation rules and ownership overrides.
* Demonstrates the multi-level security principle: An employee in Engineering cannot read a Confidential document from Finance even with `read:documents` permission, unless their clearance level and department scope match.

### 3. 4-Eyes Dual-Control Workflow (NIST SP 800-53 AC-5)
* Sensitive operations cannot be unilaterally executed by a single user.
* **Maker:** Submits request with a required business justification.
* **Anti-Self-Approval Enforcement:** The system strictly forbids $\text{requesterId} = \text{reviewerId}$. Even an Admin cannot approve their own submission.
* **Domain Role Scoping:**
  * `ROLE_ELEVATION` & `USER_DECOMMISSION`: Restricted strictly to **System Administrators (Level 100)**.
  * `CLEARANCE_UPGRADE`: Restricted to **HR Specialists or Admins**.
  * `DOCUMENT_PUBLISH`: Restricted to **Department Managers (Level $\ge$ 50) or Admins**.
* **Atomic Execution & Audit:** When approved, the proposed database state change executes atomically, and a dual-signature audit record is committed to the blockchain ledger.

### 4. Cryptographic Tamper-Evident Audit Ledger
* Standard databases allow malicious insiders or DBA accounts to alter audit records undetected.
* This platform computes a SHA-256 cryptographic block hash for each log entry:
  $$\text{Hash}_n = \text{SHA-256}(\text{Hash}_{n-1} \parallel \text{userId} \parallel \text{action} \parallel \text{resource} \parallel \text{status} \parallel \text{timestamp} \parallel \text{details})$$
* **Integrity Engine:** Inspects the entire chain from Genesis to Head. Any modification to a historical log alters its hash, breaking all subsequent links and identifying the exact tampered row.
* **Interactive UI:** Includes **"Simulate Tamper"** to demonstrate fraud detection live, and **"Repair & Recalculate Chain"** to restore cryptographic continuity.

### 5. Interactive 2D Role-Permission Matrix
* Renders a matrix of all enterprise permissions grouped by resource against roles ordered by hierarchy level.
* Visual indicators distinguish direct permissions (`✓ Direct`) from inherited ones (`↳ via <Role>`).
* Admins can toggle direct permissions on the fly with instant backend synchronization and zero page reload.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Framework** | Node.js (v18+) • Express.js (ES Modules) |
| **Database & ORM** | SQLite3 • Sequelize ORM |
| **Authentication & Crypto** | JSON Web Tokens (`jsonwebtoken`) • `bcrypt` • Node.js Native `crypto` (SHA-256) |
| **Frontend Framework** | React 18 • Vite 5 • React Router v6 |
| **Styling & Icons** | Tailwind CSS • Lucide React |
| **Logging & Utilities** | Winston Logger • Axios HTTP Client |

---

## 📁 Repository Structure

```
rbac-system/
├── .gitignore                         # Comprehensive Git ignore rules
├── README.md                          # Project documentation (this file)
│
├── backend/                           # Node.js Express REST API
│   ├── config/
│   │   └── database.js               # SQLite connection & Sequelize config
│   ├── middleware/
│   │   ├── auth.js                   # JWT, Hierarchical RBAC, ABAC PEP middleware
│   │   └── auditLogger.js            # Cryptographic audit logging middleware
│   ├── models/
│   │   ├── User.js                   # User model with clearance & department
│   │   ├── Role.js                   # Role model with parentRoleId hierarchy
│   │   ├── Permission.js             # Granular permission model
│   │   ├── Resource.js               # System protected resources
│   │   ├── Document.js               # Enterprise documents (ABAC domain)
│   │   ├── ApprovalRequest.js        # 4-Eyes Dual-Control requests model
│   │   ├── AuditLog.js               # Cryptographic SHA-256 audit ledger
│   │   └── index.js                  # Model associations & relationships
│   ├── routes/
│   │   ├── auth.js                   # Login, register, profile
│   │   ├── users.js                  # Scoped user management
│   │   ├── roles.js                  # Role CRUD & hierarchy cycle detection
│   │   ├── permissions.js            # Permission CRUD
│   │   ├── documents.js              # ABAC protected document CRUD
│   │   ├── approvals.js              # 4-Eyes workflow endpoints
│   │   └── audit.js                  # Cryptographic verification & tamper simulation
│   ├── utils/
│   │   ├── abacEngine.js             # NIST SP 800-162 Policy Decision Point
│   │   ├── hierarchyResolver.js      # Recursive role inheritance resolver
│   │   ├── auditChain.js             # SHA-256 blockchain hashing & verification
│   │   └── seed.js                   # Enterprise database seeder
│   ├── verify_cryptography_suite.js  # Automated Cryptography & Audit test suite
│   ├── verify_approvals_suite.js     # Automated 4-Eyes Dual-Control test suite
│   ├── .env.example                  # Environment configuration template
│   ├── server.js                     # Backend application entry point
│   └── package.json
│
└── frontend/                          # React + Tailwind + Vite SPA
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx            # Top bar with responsive clearance/dept badges
    │   │   ├── Layout.jsx            # Authenticated layout wrapper
    │   │   ├── PrivateRoute.jsx      # Permission-based client route protection
    │   │   └── LoadingSpinner.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx       # Auth state, effective permissions & roles
    │   ├── pages/
    │   │   ├── Login.jsx             # Login with 1-click test persona quick-fill
    │   │   ├── Dashboard.jsx         # Executive security overview
    │   │   ├── Documents.jsx         # ABAC Document management showcase
    │   │   ├── Approvals.jsx         # 4-Eyes Maker-Checker approval portal
    │   │   ├── AuditLogs.jsx         # Tamper-evident blockchain ledger viewer
    │   │   ├── Permissions.jsx       # Interactive 2D Role-Permission Matrix
    │   │   ├── Roles.jsx             # Role inheritance configuration
    │   │   └── Users.jsx             # Enterprise user management
    │   ├── utils/
    │   │   └── api.js                # Axios client with interceptors
    │   ├── App.jsx                   # Client routes configuration
    │   └── main.jsx
    ├── tailwind.config.js
    ├── vite.config.js
    └── package.json
```

---

## ⚡ Getting Started & Installation

### Prerequisites
* **Node.js** (v18.0.0 or higher)
* **npm** (v9.0.0 or higher)
* **Git**

---

### Step 1: Clone the Repository
```bash
git clone <your-github-repo-url>
cd rbac-system
```

---

### Step 2: Configure & Seed the Backend

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` file from the provided template:
   ```bash
   # On Windows PowerShell:
   Copy-Item .env.example .env

   # On Linux / macOS:
   cp .env.example .env
   ```
4. Seed the database with enterprise hierarchy, ABAC documents, and cryptographic audit genesis blocks:
   ```bash
   npm run seed
   ```
5. Start the backend server:
   ```bash
   npm run dev
   # Or: node server.js
   ```
   *Backend runs on:* `http://localhost:5000`

---

### Step 3: Start the Frontend Application

1. Open a **new terminal** and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *Frontend opens at:* `http://localhost:5173`

4. Open `http://localhost:5173` in your browser. Use the **1-Click Test Persona** buttons on the login screen to sign in as **Admin**, **Manager**, **HR**, or **Employee**!

---

## 🧪 Automated Test Suites

The codebase includes comprehensive in-process verification suites covering cryptography, tamper detection, and Maker-Checker enforcement:

### 1. Cryptography & Audit Ledger Test Suite
Validates deterministic SHA-256 hashing, avalanche effects, blockchain continuity, tamper detection, and ledger repair:
```bash
node backend/verify_cryptography_suite.js
```
*Result: 23/23 Tests Passed (100% Success)*

### 2. 4-Eyes Dual-Control Workflow Test Suite
Validates Separation of Duties (NIST AC-5), anti-self-approval enforcement, independent Checker execution, and rejection flows:
```bash
node backend/verify_approvals_suite.js
```
*Result: 15/15 Tests Passed (100% Success)*

---

## 📤 How to Push to GitHub

Follow these steps to initialize and push this project to a new repository on your GitHub account:

### 1. Initialize Git in the Project Root
Open a terminal in the root folder (`rbac-system`):
```bash
git init
```

### 2. Add and Commit Files
The pre-configured `.gitignore` will automatically prevent `node_modules/`, `database.sqlite`, and `.env` from being tracked:
```bash
git add .
git commit -m "feat: complete enterprise RBAC1, ABAC, 4-Eyes dual-control and cryptographic audit ledger"
```

### 3. Rename Default Branch to `main`
```bash
git branch -M main
```

### 4. Link Your GitHub Repository & Push
Create an empty repository on [GitHub](https://github.com/new) (e.g., `enterprise-rbac-abac-system`), then link and push:
```bash
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

---

## 🎓 Course Evaluation & Academic Standards

This project fulfills and exceeds the requirements for advanced enterprise software engineering courses:

| Requirement / Standard | Implementation in this Project | Code Reference |
| :--- | :--- | :--- |
| **NIST RBAC1 (Hierarchical RBAC)** | DAG role inheritance, recursive transitive permission resolver, role rank dominance. | [backend/utils/hierarchyResolver.js](backend/utils/hierarchyResolver.js) |
| **NIST SP 800-162 (ABAC)** | Policy Decision Point evaluating multi-attribute vectors (department, clearance, classification). | [backend/utils/abacEngine.js](backend/utils/abacEngine.js) |
| **NIST SP 800-53 (AC-5 Separation of Duties)** | 4-Eyes Maker-Checker authorization engine with anti-self-approval enforcement. | [backend/routes/approvals.js](backend/routes/approvals.js) |
| **Non-Repudiation & Cryptographic Integrity** | Blockchain-style SHA-256 hash chaining with automated fraud detection and recovery. | [backend/utils/auditChain.js](backend/utils/auditChain.js) |
| **Interactive Visualization** | Real-time 2D Role-Permission Matrix with live toggle and inheritance tracing. | [frontend/src/pages/Permissions.jsx](frontend/src/pages/Permissions.jsx) |

---

## 📄 License
This project is licensed under the [ISC License](LICENSE).
