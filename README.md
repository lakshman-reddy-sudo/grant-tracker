# 🔗 GrantChain — Transparent Grant & Fund Tracking on Algorand

> A blockchain-based grant management system that ensures transparent, milestone-based allocation and utilization of student project funds using the Algorand TestNet.

**🌐 Live Demo:** [lakshman-reddy-sudo.github.io/grant-tracker](https://lakshman-reddy-sudo.github.io/grant-tracker/)

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Solution Overview](#-solution-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Features](#-features)
- [Project Structure](#-project-structure)
- [Setup & Installation](#-setup--installation)
- [How It Works](#-how-it-works)
- [Demo Flow](#-demo-flow-for-judges)
- [Algorand Integration Details](#-algorand-integration-details)
- [Screenshots](#-screenshots)
- [Team](#-team)

---

## 🎯 Problem Statement

**Project 3: Transparent Grant and Fund Tracking System for Student Projects**

> Build a blockchain-based grant and fund tracking system using Algorand to ensure transparent, milestone-based allocation and utilization of student project funds. The system should provide clear visibility into how funds are released and spent.

### What We Built
- ✅ Grant creation and funding interface
- ✅ Milestone-based fund configuration & disbursement
- ✅ Milestone approval and fund release mechanism
- ✅ Real-time transaction dashboard
- ✅ DAO-style voting interface for approvals
- ✅ Public transparency page

---

## 💡 Solution Overview

GrantChain is a **No-TEAL** (no custom smart contracts) grant tracking system that uses **native Algorand features**:

| Algorand Feature | How We Use It |
|---|---|
| **Multisig Accounts** | 2-of-3 escrow wallet (Sponsor + Admin + Team) to lock grant funds |
| **Payment Transactions** | Real ALGO transfers for funding grants and releasing milestone payments |
| **Transaction Notes** | On-chain storage of milestone descriptions, expense data, and audit trails |
| **Pera Wallet** | Mobile wallet signing for all on-chain operations |
| **Indexer API** | Fetching transaction history and account balances in real-time |

**Why No TEAL?**
> "We use Algorand's native multisig escrow instead of custom contracts for security, simplicity, and zero contract-bug risk."

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                     │
│  (Login, Dashboard, GrantDetail, Analytics, Public)  │
└─────────────────┬───────────────────┬───────────────┘
                  │                   │
                  ▼                   ▼
    ┌─────────────────┐   ┌──────────────────────┐
    │   Pera Wallet    │   │   localStorage       │
    │ (TestNet Signing)│   │  (Grant Metadata)    │
    └────────┬────────┘   └──────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────┐
    │         Algorand TestNet                 │
    │                                          │
    │  • algod API  (submit transactions)      │
    │  • Indexer API (query history/balances)   │
    │  • Multisig    (escrow addresses)         │
    │  • Txn Notes   (on-chain data)            │
    └─────────────────────────────────────────┘
```

### Data Flow

```
Sponsor creates grant → Multisig escrow address generated
                       → Sponsor funds escrow (real ALGO via Pera)
                       
Team submits milestone → Admin reviews & approves (DAO vote)
                       → Sponsor releases funds (real ALGO transfer)
                       → Transaction ID visible on Pera Explorer
                       
Team logs expenses    → 0-ALGO self-transaction with note field
                       → Expense data permanently on blockchain
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 | UI components and routing |
| **Build Tool** | Vite 7 | Fast dev server and production builds |
| **Styling** | Vanilla CSS | Dark mode glassmorphism design |
| **Blockchain SDK** | `algosdk` v3 | Transaction creation, multisig, submission |
| **Wallet** | `@perawallet/connect` | Mobile wallet QR code signing |
| **Routing** | `react-router-dom` v7 | HashRouter for SPA on GitHub Pages |
| **Storage** | localStorage | Grant metadata, milestones, expenses |
| **Deployment** | GitHub Pages + `gh-pages` | Static hosting |

### Key Dependencies

```json
{
  "algosdk": "^3.5.2",
  "@perawallet/connect": "^1.5.1",
  "react": "^19.2.0",
  "react-router-dom": "^7.13.1",
  "buffer": "^6.0.3"
}
```

---

## ✨ Features

### 🔐 Role-Based Access Control

| Role | Capabilities |
|------|-------------|
| **🏛️ Sponsor** | Create grants, fund escrow (real ALGO), release milestone payments, view analytics |
| **🎓 Admin/Faculty** | Review milestone submissions, approve/reject milestones, cast DAO votes |
| **👨‍💻 Student Team** | Submit milestone deliverables, log expenses on-chain, resubmit rejected work |

### 📄 Pages

1. **Login Page** — Name entry, role selection, Pera Wallet connection (TestNet)
2. **Landing Page** — Feature overview with role-specific welcome message
3. **Dashboard** — Role-based stats, action items queue, grant cards with progress bars, recent transactions
4. **Create Grant** — Sponsor-only form with project details, participant wallets, configurable milestones (must total 100%), auto-generates 2-of-3 multisig escrow address
5. **Grant Detail** — Full milestone timeline with role-gated actions:
   - Team: Submit work, resubmit rejected milestones
   - Admin: Approve/reject with notes, DAO voting (👍/👎)
   - Sponsor: Fund grant & release milestone payments via Pera Wallet
   - All: View on-chain transaction links, expense logs, vote tallies
6. **Analytics Dashboard** — SVG donut chart for milestone status, expense breakdown by category (bar charts), fund utilization per grant with progress indicators
7. **Public Transparency Page** — No login required, expandable grant cards, all milestones and transactions visible, blockchain verification links

### ⛓️ On-Chain Operations

| Action | Algorand Operation | Who |
|--------|-------------------|-----|
| **Fund Grant** | Real ALGO payment → escrow/team wallet | Sponsor |
| **Release Milestone** | Real ALGO payment with note: `GRANTCHAIN MILESTONE: ...` | Sponsor |
| **Log Expense** | 0-ALGO self-transaction with note: `GRANTCHAIN EXPENSE: ...` | Team |

All transactions are signed via **Pera Wallet** and submitted to **Algorand TestNet**. Transaction IDs link directly to **Pera Explorer** for verification.

### 🗳️ DAO-Style Voting

- Sponsors and Admins can vote 👍/👎 on submitted milestones
- Vote tallies displayed on each milestone
- Prevents double voting (updates existing vote)
- Transparent governance visible to all roles

---

## 📁 Project Structure

```
grant-tracker/
├── index.html              # Entry point
├── package.json            # Dependencies & scripts
├── vite.config.js          # Vite config (base path, Buffer polyfill)
├── src/
│   ├── main.jsx            # React entry + Buffer polyfill
│   ├── App.jsx             # Router, NavBar, ProtectedRoute, wallet state
│   ├── index.css           # Full design system (dark glassmorphism)
│   ├── pages/
│   │   ├── Login.jsx       # Auth + Pera Wallet connection
│   │   ├── Landing.jsx     # Hero + feature cards
│   │   ├── Dashboard.jsx   # Role-based stats & action items
│   │   ├── CreateGrant.jsx # Grant form + multisig generation
│   │   ├── GrantDetail.jsx # Milestone timeline + on-chain actions
│   │   ├── Analytics.jsx   # Charts & fund utilization
│   │   └── PublicView.jsx  # Public transparency dashboard
│   └── utils/
│       ├── algorand.js     # Algod/Indexer clients, txn helpers, multisig
│       ├── wallet.js       # Pera Wallet connect/disconnect/sign
│       └── store.js        # localStorage CRUD, auth, demo data
└── dist/                   # Production build output
```

---

## 🚀 Setup & Installation

### Prerequisites

- **Node.js** v18+ and npm
- **Pera Wallet** app on mobile (set to **TestNet**)
- **TestNet ALGO** from the [Algorand Dispenser](https://bank.testnet.algorand.network/)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/lakshman-reddy-sudo/grant-tracker.git
cd grant-tracker

# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
# → http://localhost:5173/grant-tracker/
```

### Build & Deploy

```bash
# Production build
npm run build

# Deploy to GitHub Pages
npm run deploy
```

### Wallet Setup (For Real TestNet Transactions)

1. Install **Pera Wallet** on your phone (iOS/Android)
2. Switch to **TestNet** (tap network dropdown in Pera → select TestNet)
3. Create **3 accounts** (one per role: Sponsor, Admin, Team)
4. Fund each account with test ALGO from [dispenser](https://bank.testnet.algorand.network/)
5. When logging in to GrantChain, connect the appropriate wallet for each role

---

## ⚙️ How It Works

### 1. Grant Creation (Sponsor)
```
Sponsor fills form → Enters participant wallet addresses
                   → algosdk.multisigAddress() generates 2-of-3 escrow
                   → Grant metadata saved to localStorage
                   → Sponsor funds escrow via Pera (real ALGO transfer)
```

### 2. Milestone Lifecycle
```
pending → [Team submits work] → submitted
submitted → [Admin approves] → approved
         → [Admin rejects]  → rejected → [Team resubmits] → pending
approved → [Sponsor releases ALGO via Pera] → funded ✅
```

### 3. Expense Logging (Team)
```
Team fills expense form → createNoteTxn(address, "GRANTCHAIN EXPENSE: ...")
                        → Sign with Pera Wallet
                        → 0-ALGO self-transaction submitted to TestNet
                        → Transaction ID stored & linked to Pera Explorer
```

### 4. Multisig Escrow

```javascript
// From algorand.js
const msigParams = {
    version: 1,
    threshold: 2,        // 2-of-3 signatures required
    addrs: [sponsorAddr, adminAddr, teamAddr],
};
const escrowAddr = algosdk.multisigAddress(msigParams);
```

---

## 🎤 Demo Flow (For Judges)

### Setup (Before Demo)
1. Three team members each have Pera Wallet on TestNet with ~10 ALGO
2. Clear browser localStorage for fresh demo data

### Live Demo Steps

| Step | Who | Action | What Judges See |
|------|-----|--------|----------------|
| 1 | Sponsor | Login → Connect Pera → Create Grant with 3 milestones | Grant form with real wallet addresses, escrow generated |
| 2 | Sponsor | Click "Fund Grant" → Sign in Pera | Real ALGO leaves sponsor wallet, transaction on Explorer |
| 3 | Team | Login → Go to grant → Submit Milestone 1 | Submission note saved, status changes to "Submitted" |
| 4 | Admin | Login → See "Review" action item → Approve | DAO vote recorded, status changes to "Approved" |
| 5 | Sponsor | Login → See "Release Funds" → Sign in Pera | Real ALGO sent to team wallet, Pera Explorer link appears |
| 6 | Team | Log an expense → Sign in Pera | 0-ALGO self-txn on blockchain with expense note |
| 7 | Anyone | Visit Public page | Full transparency — all grants, milestones, transactions visible |
| 8 | Anyone | Click any Txn ID → Opens Pera Explorer | **Real blockchain verification** ✅ |

### Key Talking Points
- 💰 "Every fund transfer is a real Algorand transaction"
- 🔐 "Multisig escrow ensures no single person can move funds"
- 📝 "Expenses are permanently logged on the blockchain"
- 🌍 "Public dashboard — anyone can verify without logging in"
- ⚡ "No smart contracts = zero contract bugs, faster development"

---

## 🔗 Algorand Integration Details

### Endpoints Used

| Service | URL | Purpose |
|---------|-----|---------|
| **Algod** | `https://testnet-api.algonode.cloud` | Submit transactions, get params |
| **Indexer** | `https://testnet-idx.algonode.cloud` | Query transaction history |
| **Pera Explorer** | `https://testnet.explorer.perawallet.app` | Verify transactions |

### Key SDK Functions

```javascript
// Transaction creation
algosdk.makePaymentTxnWithSuggestedParamsFromObject({ from, to, amount, note, suggestedParams })

// Multisig address generation
algosdk.multisigAddress({ version: 1, threshold: 2, addrs: [...] })

// Pera Wallet signing
peraWallet.signTransaction([[{ txn }]])

// Submit to network
algodClient.sendRawTransaction(signedTxn).do()

// Wait for confirmation
algosdk.waitForConfirmation(algodClient, txid, 4)
```

### Transaction Types

| Type | Amount | Note Format | Purpose |
|------|--------|-------------|---------|
| Fund | N ALGO | `GRANTCHAIN FUND: {name} \| Amount: N ALGO` | Sponsor funds grant |
| Release | N ALGO | `GRANTCHAIN MILESTONE: {name} \| Grant: {grant}` | Milestone payment |
| Expense | 0 ALGO | `GRANTCHAIN EXPENSE: {desc} \| N ALGO \| {cat}` | Team expense log |

---

## 🎨 Design

- **Theme:** Dark mode with glassmorphism (frosted glass cards, gradient accents)
- **Colors:** Purple primary (#8b5cf6), green success (#10b981), blue info (#3b82f6)
- **Typography:** System font stack with monospace for addresses/hashes
- **Responsive:** Mobile-friendly layout with flexible grids
- **Animations:** Fade-in transitions, hover effects, gradient text

---

## 📜 Learning Outcomes

- ✅ Understanding decentralized escrow and conditional payments
- ✅ Implementing wallet-based authentication with Pera
- ✅ Building transparent financial dashboards
- ✅ Designing milestone-based fund disbursement mechanisms
- ✅ Implementing DAO-style governance voting
- ✅ Recording verifiable audit trails on blockchain

---

## 🌍 Real-World Application

GrantChain enhances accountability in grant management by:
- Building **trust** between sponsors and student teams
- Providing **full transparency** into fund utilization
- Creating **immutable audit trails** on the blockchain
- Enabling **public verification** without requiring login
- Promoting **responsible fund utilization** within institutions

---

## 👥 Team

Built for the **Algorand Open Innovation Hackathon** (No-TEAL Track)

---

## 📄 License

MIT
