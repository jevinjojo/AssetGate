<p align="center">
  <img src="packages/frontend/public/logo.png" width="110" alt="AssetGate Logo" />
</p>

# 🏛️ AssetGate

> **Institutional-grade ERC-3643 Tokenization & Compliance Platform**
> A compliance-by-design platform for tokenizing regulated real-world assets (RWA), where every transfer is gated on-chain by investor identity and configurable compliance rules.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Foundry](https://img.shields.io/badge/Foundry-Compatible-orange)](https://book.getfoundry.sh/)
[![CI](https://github.com/jevinjojo/AssetGate/actions/workflows/ci.yml/badge.svg)](https://github.com/jevinjojo/AssetGate/actions)
[![Network](https://img.shields.io/badge/Network-BOT%20Chain%20Mainnet%20(677)-0052FF)](https://scan.botchain.ai/token/0x130ae863F28E1D990a975F700F536DDFc793dcf2)
[![Status](https://img.shields.io/badge/status-live-brightgreen)](https://asset-gate.vercel.app/)

---

## 🚀 Live Platform & Infrastructure

The complete AssetGate protocol is deployed live on **BOT Chain Mainnet (Chain ID 677)** and production cloud infrastructure. 

- **Frontend Dashboard:** [https://asset-gate.vercel.app/](https://asset-gate.vercel.app/)
- **Architecture & Integration Brief:** [https://asset-gate.vercel.app/brief.html](https://asset-gate.vercel.app/brief.html)
- **AGT Token on BOT Chain Explorer:** [`0x130ae863F28E1D990a975F700F536DDFc793dcf2`](https://scan.botchain.ai/token/0x130ae863F28E1D990a975F700F536DDFc793dcf2)
- **Target Network:** BOT Chain Mainnet (`Chain ID: 677`, `RPC: https://rpc.botchain.ai`)
- **Backend API & Indexer:** [Live on Render](https://assetgate.onrender.com/api/v1/health)
- **Database:** Neon Serverless PostgreSQL
- **Smart Contracts:** Deployed and verified on BOT Chain Mainnet (ERC-3643 Core, ONCHAINID, Modular Compliance, Merkle Dividend Distributor)

---

## 🎥 Platform in Action

The full ERC-3643 pipeline in action — broken into 4 focused clips highlighting institutional compliance.

### 1️⃣ Identity Gating & On-Chain KYC
The simulated KYC onboarding flow. The investor submits their country code on the frontend, and the Node.js backend securely signs an ERC-734 identity claim, submits it on-chain to their `ONCHAINID`, and instantly whitelists the investor on the Identity Registry.


https://github.com/user-attachments/assets/062cd2ff-79ee-4cab-9c8f-b0098910eeb7


---

### 2️⃣ The Two-Gate Transfer (Blocking Illegal Trades)
This is the core of the ERC-3643 standard. The smart contract's `canTransfer` function acts as a pre-flight compliance check. We attempt to transfer tokens from a verified wallet to an **unverified** dummy address. The UI and the smart contract natively block the transaction, proving that non-compliant trades revert at the blockchain level.


https://github.com/user-attachments/assets/231a2a78-0770-4c40-af9b-889fad0ef1e2


---

### 3️⃣ Corporate Controls (Freezing & Forced Recovery)
Regulated assets require absolute legal recourse. We use the Issuer Dashboard to execute a corporate freeze on a verified wallet, locking its assets. Then, acting as the issuer, we execute a **Forced Transfer** to recover the funds from the frozen wallet into the corporate treasury—bypassing standard ERC-20 rules while maintaining full compliance.


https://github.com/user-attachments/assets/cc0ea85b-57b8-4d43-b138-058373c7bdf4


---

### 4️⃣ Merkle Dividends & The Investor Portal
Off-chain calculation with on-chain execution. The issuer creates a snapshot of the current cap table and calculates a Merkle Tree distribution for a USDC dividend. A verified investor then logs into the portal and successfully claims their allocation via a pull-payment Merkle proof.


https://github.com/user-attachments/assets/50fc73e8-3205-4b59-a8c4-f37f98c04eb0


---

## 🔒 The Problem & The Solution

### The Problem
1. **Public blockchains are permissionless, but securities are not.** Standard ERC-20 tokens can be held by anyone, making them fundamentally incompatible with regulated financial assets (equity, real estate, bonds) which require strict KYC/AML checks, investor accreditation, and jurisdictional restrictions.
2. **Off-chain compliance is fragile.** Relying on centralized off-chain databases to manually freeze wallets or revert illegal transfers defeats the purpose of tokenization and introduces severe settlement risks.

### The AssetGate Solution
1. **The Two-Gate Transfer Model.** AssetGate uses the ERC-3643 (T-REX) standard. Unlike normal tokens, every transfer first asks *"is this allowed?"* and **reverts** if not.
2. **Gate 1: Identity Registry.** Validates if the receiver is a verified investor by checking signed claims on their `ONCHAINID` from a trusted issuer.
3. **Gate 2: Modular Compliance.** Executes pluggable rule modules (e.g., maximum holder count, balance caps, country restrictions). If either gate fails, the transfer reverts natively at the smart contract level.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🛂 **Identity Gating** | Enforces KYC/eligibility natively via `ONCHAINID` (ERC-734/735) signed claims. Unverified wallets cannot receive tokens. |
| 🧩 **Modular Compliance** | Custom Solidity rule modules (`MaxHolderCountModule`, `BalanceCapModule`, `CountryRestrictModule`) executed atomically on every transfer. |
| 🛑 **Corporate Controls** | Built-in issuer controls required by regulators: freeze, partial freeze, pause, burn, and force-transfer recovery. |
| 🛡️ **Preflight Shield** | Off-chain simulation endpoint (`/api/v1/transfer-preflight`) executing identity & compliance rules in <15ms to save 100% of failed gas fees before invoking MetaMask. |
| 💰 **Merkle Dividends** | Automated 3-step snapshot & Merkle tree payout engine for instant, pro-rata USDC distributions. |
| 📡 **Live Event Indexer** | Viem-powered Node.js indexer that listens to ERC-3643 contract events, maps them to a relational schema, and stores them in PostgreSQL. |
| 📊 **Issuer Dashboard** | React/Vite dashboard for issuers to manage cap tables, mint tokens, and execute corporate actions. |
| 🏛️ **Investor Portal** | A dedicated view for verified investors to view their eligible holdings and identity status. |
| 🧪 **Exploit-Tested** | Contracts rigorously tested via Foundry (unit + fuzz + boundary) to ensure restricted countries or unverified users can never bypass gates. |
| ☁️ **Cloud Native** | Built for production with Vercel, Render, and Neon PostgreSQL integrations out of the box. |

---

## 🏗️ Architecture

### The Two-Gate Model

```mermaid
flowchart TD
    Sender[Sender - Verified Investor] -->|Initiates Transfer| Gate1[Gate 1: Identity Registry]
    
    Gate1 -->|Is receiver verified?| Gate2[Gate 2: Modular Compliance]
    Gate1 -.->|No: Unverified| Revert[Transaction Reverts]
    
    Gate2 -->|Do rules pass?| Success[Update Token Balances]
    Gate2 -.->|No: Rule violated| Revert
    
    Success --> Recipient[Recipient - Target Address]
```

---

## ⚡ Quickstart

### Prerequisites
- Node.js 20+
- Foundry (`forge`, `anvil`)
- BOT Chain Mainnet RPC (`https://rpc.botchain.ai`) or local Anvil
- Neon PostgreSQL database

### 1. Contracts & Local Chain

```bash
cd packages/contracts
npm install
forge build
forge test
anvil
```

In a second terminal:
```bash
cp .env.example .env
forge script script/DeployAll.s.sol --rpc-url anvil --broadcast
forge script script/Bootstrap.s.sol --rpc-url anvil --broadcast
```

### 2. Backend API & Indexer

```bash
cd packages/backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### 3. Frontend Dashboard

```bash
cd packages/frontend
cp .env.example .env
npm install
npm run dev
```

---

## 📁 Project Structure

```
AssetGate/
├── packages/
│   ├── contracts/
│   │   ├── src/                 # PermissionedToken, DependencyCheck
│   │   │   └── compliance/      # MaxHolderCount, BalanceCap, CountryRestrict
│   │   ├── script/              # DeployAll.s.sol, Bootstrap.s.sol
│   │   ├── test/                # EndToEnd, Fuzz, Boundary tests
│   │   └── deployments/         # Generated address artifacts
│   ├── backend/
│   │   ├── prisma/              # PostgreSQL schema
│   │   ├── src/
│   │   │   ├── api.ts           # Fastify REST endpoints
│   │   │   ├── indexer.ts       # Viem blockchain event listener
│   │   │   └── db.ts            # Prisma client instance
│   │   └── package.json
│   └── frontend/
│       ├── public/
│       │   └── brief.html       # Standalone Architecture & Integration Brief
│       ├── src/
│       │   ├── components/      # React: CapTable, IssuerControls, InvestorPortal
│       │   ├── App.tsx          # Main dashboard entrypoint
│       │   └── index.css        # Core design system & styles
│       └── package.json
├── ARCHITECTURE.md
├── FLOWS.md
├── IDENTITY.md
├── README.md
```

---

## 🛠️ Tech Stack

| Layer | Tools |
|---|---|
| **Contracts** | Solidity, Foundry, ERC-3643 (T-REX), ONCHAINID |
| **Backend** | Node.js, Fastify, TypeScript, Viem, Prisma, PostgreSQL |
| **Frontend** | React, TypeScript, Vite, Wagmi, Custom CSS |
| **Infra / CI** | Vercel, Render, Neon, GitHub Actions |

---

## 🤝 Contributing

Contributions are welcome — please open an issue first to discuss any major change.

---

## ⚠️ Disclaimer

AssetGate is a platform built on the ERC-3643 standard for BOT Chain. KYC is simulated (the deployer acts as the trusted claim issuer). It is **not** audited, **not** production-ready, and **not** legal or financial advice. Deploying real securities involves substantial legal and regulatory obligations.

---

## 📄 License

MIT License — see [LICENSE](./LICENSE).

---

## 👤 Author

Built by **[Jevin Jojo](https://github.com/jevinjojo)**.

---

*AssetGate: because regulated assets require absolute, on-chain compliance.*
