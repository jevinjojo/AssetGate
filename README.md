# AssetGate

> A compliance-by-design platform for tokenizing regulated real-world assets (RWA) on the **ERC-3643 (T-REX)** standard, where **every transfer is gated on-chain** by investor identity and configurable compliance rules.

AssetGate is a permissioned security-token stack. Unlike a normal ERC-20 (anyone can hold it), an ERC-3643 transfer first asks _"is this allowed?"_ and **reverts** if not — enforcing KYC/eligibility and business/legal rules directly in the smart contracts, with the issuer controls (freeze, force-transfer, pause) regulators require.

---

## The two-gate transfer model

```text
        Alice (verified) ── transfer ──▶ Bob
                        │
        ┌───────────────┴────────────────┐
   GATE 1 — Identity Registry             │  Is Bob a verified investor?
        │  registered wallet + ONCHAINID  │  (signed claims from a trusted issuer)
        └───────────────┬────────────────┘
        ┌───────────────┴────────────────┐
   GATE 2 — Modular Compliance            │  Does the transfer satisfy the rules?
        │  holder cap · balance cap ·     │  (pluggable rule modules)
        │  country restriction · …        │
        └───────────────┬────────────────┘
                 both pass ⇒ move balances
                 either fails ⇒ REVERT
```

> One-paragraph anchor: _ERC-3643 is a permissioned security-token standard where every transfer is gated by two checks — an Identity Registry (is the receiver verified, proven by signed claims on their ONCHAINID from a trusted issuer?) and a Modular Compliance module (does the transfer satisfy holder limits, balance caps, country rules?). If either fails, the transfer reverts. AssetGate is the product around that engine._

---

## V1 Definition of Done

V1 is complete when AssetGate can: deploy a full ERC-3643 / T-REX suite to a local chain and Sepolia; onboard an investor by issuing signed claims to their ONCHAINID and registering them; mint to verified investors; enforce compliance on every transfer (verified→verified succeeds, verified→unverified or rule-violating reverts); support issuer controls (freeze, partial freeze, force-transfer, pause, burn); index all token events into a database cap table; expose them via a REST API; and let an issuer manage tokens/investors and an investor view holdings/verification through a React dashboard — reproducible via a scripted end-to-end demo.

> **V1 scope note:** KYC is **simulated** — the deployer acts as its own trusted claim issuer and signs test claims. Real KYC-vendor integration and any legal/regulatory deployment are explicitly out of scope (see `V2_BACKLOG.md`). This repository is for **learning/demonstration only** and is **not** production or legal advice.

---

## Tech stack

| Layer              | Tech                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Contracts          | Solidity `0.8.17`, Foundry, OpenZeppelin `4.9.6` (+ upgradeable), ERC-3643 **T-REX 4.x**, **ONCHAINID 2.x** (ERC-734/735) |
| Testing / security | Foundry (unit + fuzz + boundary), solhint, Slither, gas snapshots                                                         |
| Backend / indexer  | TypeScript, Node, **viem**, **Fastify**, **better-sqlite3**                                                               |
| Frontend           | React, TypeScript, Vite                                                                                                   |
| Local chain        | Anvil                                                                                                                     |
| Ops                | Docker-ready, GitHub Actions CI (build · test · lint · Slither), Sepolia + Etherscan verification                         |

---

## Monorepo layout

```text
AssetGate/
├── README.md                 # this file
├── ARCHITECTURE.md           # the 5 core contracts + ONCHAINID, two-gate model
├── IDENTITY.md               # ONCHAINID keys, claims, topics, PII boundary
├── FLOWS.md                  # the 4 canonical flows, each mapped to its test
├── V2_BACKLOG.md             # everything out of scope for V1
└── packages/
    ├── contracts/            # Foundry: ERC-3643 stack + custom compliance modules
    │   ├── src/
    │   │   ├── PermissionedToken.sol        # Phase 0 thin-slice token
    │   │   ├── imports/DependencyCheck.sol  # compile-time dependency proof
    │   │   └── compliance/
    │   │       ├── MaxHolderCountModule.sol # custom module (stateful)
    │   │       ├── BalanceCapModule.sol      # custom module
    │   │       └── CountryRestrictModule.sol # custom module
    │   ├── script/           # DeployAll, Bootstrap, per-phase scripts
    │   ├── test/             # PermissionedToken, Identity, Registry, Compliance, Token, EndToEnd
    │   └── deployments/      # <network>.json address artifacts
    ├── backend/              # viem indexer + Fastify API + SQLite (Phase 0)
    └── frontend/             # React + Vite cap-table dashboard (Phase 0)
```

---

## Prerequisites

- [Foundry](https://book.getfoundry.sh/) (`forge`, `anvil`, `cast`)
- Node.js 20+
- A Sepolia RPC URL + funded key + Etherscan API key (only for testnet deploys)

---

## Quick start (local)

### 1. Contracts — build, test, deploy on Anvil

```bash
cd packages/contracts
npm install                 # installs OZ 4.9.6, T-REX, ONCHAINID (pinned via package-lock.json)
forge build --sizes
forge test -vvv             # all suites: Phase 0,2,3,4,5,6
forge coverage --report summary

# deploy the full stack locally
anvil                                    # terminal 1
cp .env.example .env && source .env      # terminal 2 (PRIVATE_KEY = Anvil #0)
forge script script/DeployAll.s.sol --rpc-url anvil --broadcast
forge script script/Bootstrap.s.sol --rpc-url anvil --broadcast
cat deployments/anvil.json
```

### 2. Backend — indexer + API

```bash
cd packages/backend
cp .env.example .env
# set TOKEN_ADDRESS to the "token" address from deployments/anvil.json
npm install
npm run dev                 # runs the API (:4000) + the event indexer together
```

### 3. Frontend — live cap table

```bash
cd packages/frontend
cp .env.example .env        # VITE_API_URL=http://localhost:4000
npm install
npm run dev                 # http://localhost:5173
```

> When you restart Anvil, delete `packages/backend/assetgate.db` first (block numbers reset).

---

## Deploying to Sepolia

Set `PRIVATE_KEY` (funded), `SEPOLIA_RPC_URL`, `ETHERSCAN_API_KEY`, and `DEMO_INVESTOR` in `packages/contracts/.env`, then:

```bash
cd packages/contracts
source .env
forge script script/DeployAll.s.sol --rpc-url sepolia --broadcast --verify
forge script script/Bootstrap.s.sol --rpc-url sepolia --broadcast
cat deployments/sepolia.json
```

Every contract is deployed in dependency order, wired, configured (required claim topic, trusted issuer, three compliance modules, agents), and verified on Etherscan.

---

## Deployed contracts

### Anvil (Chain ID `31337`) — local development

| Contract                  | Address                                      |
| ------------------------- | -------------------------------------------- |
| Token (AGT)               | `0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e` |
| Claim Topics Registry     | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Trusted Issuers Registry  | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| Identity Registry Storage | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` |
| Identity Registry         | `0x0165878A594ca255338adfa4d48449f69242Eb8F` |
| Modular Compliance        | `0x8A791620dd6260079BF849Dc5567aDC3F2FdC318` |
| Claim Issuer              | `0x9A676e781A523b5d0C0e43731313A708CB607508` |
| Max Holder Count Module   | `0x68B1D87F95878fE05B998F19b66F4baba5De1aed` |
| Balance Cap Module        | `0x59b670e9fA9D0A427751Af201D676719a970857b` |
| Country Restrict Module   | `0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f` |
| Deployer                  | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |

Artifact: `packages/contracts/deployments/anvil.json`

### Sepolia (Chain ID `11155111`) — live testnet

| Contract                  | Address                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Token (AGT)               | [`0x7FeDd3a0CE285cEa908D037e2b03d631d7e53268`](https://sepolia.etherscan.io/address/0x7FeDd3a0CE285cEa908D037e2b03d631d7e53268) |
| Claim Topics Registry     | [`0x45aBe7996124e10B8EeD7Ce743E9793e0031cd19`](https://sepolia.etherscan.io/address/0x45aBe7996124e10B8EeD7Ce743E9793e0031cd19) |
| Trusted Issuers Registry  | [`0xB702816250A8509eC20096967Ab623A475ED1aCf`](https://sepolia.etherscan.io/address/0xB702816250A8509eC20096967Ab623A475ED1aCf) |
| Identity Registry Storage | [`0x9E1A4F0F2CeAB7dcFCbF7F81C87dd56990c6feC4`](https://sepolia.etherscan.io/address/0x9E1A4F0F2CeAB7dcFCbF7F81C87dd56990c6feC4) |
| Identity Registry         | [`0xf371a0f4AF1aB7203584787D07126D2A3B6680C3`](https://sepolia.etherscan.io/address/0xf371a0f4AF1aB7203584787D07126D2A3B6680C3) |
| Modular Compliance        | [`0x56a2F5568630bB821bC659E6813b0bfAC8D53a94`](https://sepolia.etherscan.io/address/0x56a2F5568630bB821bC659E6813b0bfAC8D53a94) |
| Claim Issuer              | [`0x34876e8e38780bf0AA45fe0acc50bF44d083E6b7`](https://sepolia.etherscan.io/address/0x34876e8e38780bf0AA45fe0acc50bF44d083E6b7) |
| Max Holder Count Module   | [`0xd3B6F13F543514155A8F1b5aC47F5E81D8FF5ae3`](https://sepolia.etherscan.io/address/0xd3B6F13F543514155A8F1b5aC47F5E81D8FF5ae3) |
| Balance Cap Module        | [`0xB100d0e299adD573AE305C70046d0Da6C146b170`](https://sepolia.etherscan.io/address/0xB100d0e299adD573AE305C70046d0Da6C146b170) |
| Country Restrict Module   | [`0x78e5547b8EA46B2cE20192Cec657DFde859B5055`](https://sepolia.etherscan.io/address/0x78e5547b8EA46B2cE20192Cec657DFde859B5055) |
| Deployer                  | `0x7DF5Bc20028cd12E0c19886d5D33c77AFE7FCF85`                                                                                    |

Artifact: `packages/contracts/deployments/sepolia.json`

### Sepolia bootstrap (demo investor)

| Item                 | Value                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Demo investor wallet | [`0xa5a62376461bC6D211c957ef8e38BDAd54d08608`](https://sepolia.etherscan.io/address/0xa5a62376461bC6D211c957ef8e38BDAd54d08608) |
| Investor ONCHAINID   | [`0xE7E8EaFa4Faa08D9b41F5a4d875eA0954E0C3ff0`](https://sepolia.etherscan.io/address/0xE7E8EaFa4Faa08D9b41F5a4d875eA0954E0C3ff0) |
| Status               | KYC claim issued · registered in Identity Registry · **1,000 AGT** minted                                                       |

Artifacts: `packages/contracts/deployments/sepolia-bootstrap.json` · `packages/contracts/broadcast/Bootstrap.s.sol/11155111/run-latest.json`

---

## Compliance modules

All three are **custom**, written against the T-REX `AbstractModule` interface (`moduleCheck` gate + `transferred/created/destroyed` bookkeeping hooks).

| Module                  | Rule enforced               | Notes                                                   |
| ----------------------- | --------------------------- | ------------------------------------------------------- |
| `MaxHolderCountModule`  | ≤ N distinct holders        | stateful — tracks holders via post-action hooks         |
| `BalanceCapModule`      | ≤ N tokens per wallet       | reads the recipient's live token balance                |
| `CountryRestrictModule` | allow-listed countries only | reads the investor's country from the Identity Registry |

---

## The four end-to-end flows

Proven in `packages/contracts/test/EndToEnd.t.sol` (see `FLOWS.md`):

- **A — Onboarding:** claim issued → wallet registered → becomes eligible.
- **B — Issuance:** configure topics/issuers/rules → mint to verified investors.
- **C — Transfer:** verified→verified passes; unverified fails Gate 1; restricted-country fails Gate 2.
- **D — Corporate control:** freeze, force-transfer recovery, pause.

---

## Testing & CI

```bash
cd packages/contracts
forge test -vvv                 # unit + fuzz + boundary
forge coverage --report summary
forge snapshot                  # (re)baseline gas
npx solhint 'src/**/*.sol'
```

GitHub Actions runs on every push/PR:

- **Build · Test · Lint** — `forge build`, `forge test`, `forge snapshot --check` (gas regression gate), `solhint`.
- **Slither** — static analysis (`fail-on: high`, third-party code filtered).

---

## Roadmap

| Phase | Description                                                         | Status |
| ----: | ------------------------------------------------------------------- | :----: |
|     0 | Project discipline & thin slice (chain → indexer → DB → API → UI)   |   ✅   |
|     1 | Solidity foundation & dev environment (T-REX / ONCHAINID wired, CI) |   ✅   |
|     2 | ONCHAINID & claims (identity layer)                                 |   ✅   |
|     3 | The four registries (eligibility backbone)                          |   ✅   |
|     4 | Modular compliance (custom rule modules)                            |   ✅   |
|     5 | The ERC-3643 token (dual-gate transfers + issuer controls)          |   ✅   |
|     6 | End-to-end flows & full test suite (fuzz + boundary)                |   ✅   |
|     7 | Deployment pipeline (Anvil + Sepolia, verified)                     |   ✅   |
|     8 | Backend indexer & API (cap table)                                   |   ⏳   |
|     9 | Issuer admin dashboard                                              |   ⏳   |
|    10 | Investor portal & simulated KYC                                     |   ⏳   |
|    11 | Corporate actions (dividends & recovery)                            |   ⏳   |
|    12 | Hardening, docs & demo                                              |   ⏳   |

---

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the 5 core contracts, ONCHAINID, and the two-gate model
- [`IDENTITY.md`](./IDENTITY.md) — ONCHAINID keys, claims, topics, and the on-chain/off-chain PII boundary
- [`FLOWS.md`](./FLOWS.md) — the four canonical flows, each mapped to the exact test that proves it
- [`V2_BACKLOG.md`](./V2_BACKLOG.md) — everything intentionally out of scope for V1

---

## Disclaimer

AssetGate is an educational/portfolio project demonstrating the ERC-3643 standard. KYC is simulated (the deployer acts as the trusted claim issuer). It is **not** audited, **not** production-ready, and **not** legal or financial advice. Deploying real securities involves substantial legal and regulatory obligations.

## License

MIT
