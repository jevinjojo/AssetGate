# AssetGate — Project Plan

> A compliance-by-design platform for tokenizing regulated real-world assets on the ERC-3643 (T-REX) standard, where every transfer is gated by on-chain identity and compliance.

_(Name is a placeholder — rename freely. Repo: `AssetGate`.)_

## Project Philosophy & Guardrails

**V1 Definition of Done**

> V1 is complete when AssetGate can: deploy a full ERC-3643 / T-REX contract suite (Token + Identity Registry + Compliance + Trusted Issuers + Claim Topics) to a local chain and to Sepolia; onboard an investor by issuing signed claims to their ONCHAINID and registering them in the Identity Registry; mint tokens to verified investors; enforce compliance on **every** transfer (verified→verified succeeds, verified→unverified or rule-violating transfer reverts); support the issuer controls regulators require (freeze address, freeze partial balance, force-transfer, pause, burn); index all token events into a database cap table; expose that data through a REST API; and let an issuer manage tokens/investors and an investor view holdings/verification through a React dashboard — all reproducible via a single scripted end-to-end demo.

**Scope Protection**

- Anything not required by the Definition of Done goes into `V2_BACKLOG.md`. No exceptions.
- Scope for this build stops at the **issuer dashboard + investor portal on Sepolia**. Real KYC vendor integration and any real legal/regulatory deployment are explicitly V2.
- KYC is **simulated** in V1: you act as your own trusted claim issuer granting test claims. This is the correct, honest portfolio scope.

**Out of scope for V1 (put in V2_BACKLOG.md)**

- Real third-party KYC/AML vendor integration (V1 simulates the issuer)
- Real legal/regulatory/securities deployment
- Secondary market / DEX / order book / on-chain trading venue
- Fiat on/off ramps, payments rails, custody
- Cross-chain / multi-chain deployment
- Mobile app / browser extension
- Compliance-module marketplace / pluggable third-party rule store
- On-chain governance / DAO tooling
- Real fiat/stablecoin dividend settlement at scale (V1 = mock-stablecoin demo only)
- Multi-tenant SaaS, billing, RBAC beyond issuer/agent/investor

## Naming

- Project: **AssetGate** (evokes _attestation_ — the signed claims at the heart of ONCHAINID)
- Repo: `AssetGate`
- Avoid reusing names from prior projects.

## Final V1 Architecture

```text
                 Issuer / Agent (admin wallet)
                          |
        deploy + configure via Foundry scripts
                          |
                          v
        +----------------------------------------+
        |         ERC-3643 Token (T-REX)          |
        |  transfer() -> identity + compliance    |
        |  gate -> mint / burn / freeze / pause   |
        +----------------------------------------+
              |                          |
              v                          v
     Identity Registry            Modular Compliance
        |        |                       |
        v        v                       v
   Trusted    Claim Topics          Rule Modules
   Issuers      Registry        (max holders, country,
   Registry       |              balance limits, lockup)
       |          |
       +----+-----+
            |
            v
    Identity Registry Storage
            |
            v
    ONCHAINID (investor identity + signed claims)
            ^
            |
   Claim Issuer (simulated KYC provider)

  --- on-chain events (mint / transfer / freeze / pause) ---
                          |
                          v
                Backend Event Indexer (viem)
                          |
                          v
             PostgreSQL (cap table, events, status)
                          |
                +---------+----------+
                |                    |
                v                    v
          Fastify REST API      Health / Metrics
                          |
                          v
             React + Vite Dashboard (wagmi + viem)
                |                          |
                v                          v
          Issuer Admin               Investor Portal
```

## V1 Technology Stack

**Contracts:** Solidity ^0.8.20, Foundry, OpenZeppelin, ERC-3643 T-REX reference implementation, ONCHAINID (ERC-734/735)
**Testing/Security:** Foundry (unit + fuzz + fork), solhint, Slither
**Indexer/Backend:** TypeScript, Node, viem, Fastify, Prisma, PostgreSQL (SQLite acceptable for the thin slice)
**Frontend:** React, TypeScript, Vite, wagmi + viem, RainbowKit, Tailwind (optional)
**Local chain:** Anvil (Foundry)
**Ops:** Docker, Docker Compose, GitHub Actions (forge test + solhint + Slither), Sepolia + Etherscan verification

---

## Phase 0 — Project Discipline & The Thin Slice

**Goal:** Move one transfer from a minimal permissioned token → indexer → DB → API → live React cap table, before touching real T-REX complexity.

- 0.1 Create repo structure; add `README.md` (with Definition of Done) and `V2_BACKLOG.md`.
- 0.2 Write the project contract (V1 DoD at top of README; out-of-scope list in backlog).
- 0.3 Build a **minimal** permissioned token: a stripped ERC-20 whose `transfer` reverts unless both parties are in a hardcoded `whitelist` mapping (NOT the real standard yet — just the _gating concept_).
- 0.4 Build the thin slice:
  1. Deploy the minimal token to local Anvil via a Foundry script
  2. Minimal viem indexer catches one `Transfer` event
  3. Persist holder balances to the database
  4. `GET /api/v1/health` + `GET /api/v1/holders`
  5. React dashboard displays the cap table
  6. A verified→unverified transfer visibly reverts; the dashboard reflects only successful transfers

**Exit criteria**

- Repo discipline files exist (`README.md`, `V2_BACKLOG.md`, `.env.example`)
- Foundry project compiles; local deploy script works against Anvil
- DB migration works; indexer persists before serving
- API health + holders endpoints work
- React dashboard renders the cap table with loading/empty/error states
- One-command local run documented in README (Anvil → deploy → index → API → UI)

---

## Phase 1 — Solidity Foundation & Dev Environment

**Goal:** A clean Foundry workspace with the real ERC-3643 / ONCHAINID dependencies wired in and understood.

- 1.1 `forge init`; add `contracts/`, `script/`, `test/` layout; configure `foundry.toml` + `remappings.txt`.
- 1.2 Install dependencies: OpenZeppelin, the ERC-3643 (T-REX) reference contracts, ONCHAINID (ERC-734/735). Pin versions.
- 1.3 Write an `ARCHITECTURE.md` mapping the 5 core contracts + ONCHAINID to their responsibilities (your own words).
- 1.4 Add CI (GitHub Actions): `forge build`, `forge test`, `solhint`, `slither` (fail-on high, filter `lib/`).
- 1.5 Add `solhint` config and a gas-snapshot baseline.

**Exit criteria**

- `forge build`, `forge test`, `solhint`, and Slither all pass in CI
- Remappings resolve all T-REX/ONCHAINID imports
- `ARCHITECTURE.md` accurately describes each component and the two-gate transfer model
- `.env.example` documents every required variable

---

## Phase 2 — ONCHAINID & Claims (Identity Layer)

**Goal:** Stand up on-chain identities and issue/verify signed claims — the foundation of "who is allowed."

- 2.1 Deploy an ONCHAINID `Identity` contract for a test investor (identity ≠ wallet).
- 2.2 Deploy a `ClaimIssuer` (your simulated KYC provider / trusted issuer).
- 2.3 Implement the claim lifecycle: issuer signs a claim off-chain → claim added to the investor's ONCHAINID (topic, issuer, signature, data).
- 2.4 Implement/verify `isClaimValid` and reading claims by topic.
- 2.5 Foundry tests: valid claim verifies; tampered signature fails; claim from an untrusted issuer is rejected.

**Exit criteria**

- An identity can hold a signed KYC claim from the claim issuer
- Claim verification passes for a legitimately signed claim and fails for tampered/untrusted ones
- Tests document the topic/issuer/signature model clearly
- `IDENTITY.md` notes explain claims, topics, issuers, and the on-chain/off-chain PII boundary

---

## Phase 3 — The Registries (Eligibility Backbone)

**Goal:** Wire the four registries so the token can answer "is this receiver a verified investor?"

- 3.1 Deploy `ClaimTopicsRegistry` (which claim topics are required — e.g., KYC, accreditation, country).
- 3.2 Deploy `TrustedIssuersRegistry` (which issuers may vouch for which topics).
- 3.3 Deploy `IdentityRegistryStorage` (shared investor store).
- 3.4 Deploy `IdentityRegistry` and bind it to the three above; register an investor (wallet → ONCHAINID → country).
- 3.5 Implement/verify `IdentityRegistry.isVerified(address)` end-to-end.
- 3.6 Tests: verified investor returns `true`; missing claim / untrusted issuer / unregistered wallet returns `false`.

**Exit criteria**

- `isVerified()` returns correct results across all eligibility cases
- One `IdentityRegistryStorage` can back the registry (shared-registry design demonstrated)
- Agent can register/update/remove an investor
- Full registry test suite green

---

## Phase 4 — Compliance (The Rulebook)

**Goal:** Enforce configurable business/legal rules on transfers via modular compliance.

- 4.1 Deploy `ModularCompliance`; bind it to a token placeholder.
- 4.2 Implement/plug rule modules: **max holder count**, **max balance per investor**, **country restriction** (allow/deny list). (Reuse T-REX modules where available; write at least one yourself to prove understanding.)
- 4.3 Implement `canTransfer(from, to, amount)` aggregation across active modules.
- 4.4 Implement compliance bookkeeping hooks (`transferred`, `created`, `destroyed`) so holder counts stay accurate.
- 4.5 Tests: transfer that would exceed max holders reverts; over-limit balance reverts; restricted country reverts; compliant transfer passes.

**Exit criteria**

- Each rule module independently blocks the correct violation and allows valid transfers
- Modules can be added/removed by the owner
- Holder-count/limit bookkeeping stays correct across mint/transfer/burn
- At least one self-authored module with line-by-line explanation in comments

---

## Phase 5 — The ERC-3643 Token (Transfer Gating + Issuer Controls)

**Goal:** The token itself — ERC-20-compatible, but every transfer passes the identity + compliance gates, plus the privileged controls regulators require.

- 5.1 Deploy the ERC-3643 `Token`, bound to the `IdentityRegistry` and `ModularCompliance`.
- 5.2 Confirm the override: `transfer`/`transferFrom` revert unless `isVerified(to)` **and** `canTransfer(...)`.
- 5.3 Implement issuer/agent controls: `mint`, `burn`, `freezeAddress`, `freezePartialTokens`, `forcedTransfer`, `pause`/`unpause`.
- 5.4 Set up agent/owner roles (AgentRole) and restrict privileged functions.
- 5.5 Tests for every control: frozen address can't send; partial-frozen amount is blocked; forced transfer bypasses (for recovery); paused token blocks all transfers; only agent can call.

**Exit criteria**

- verified→verified transfer succeeds; verified→unverified reverts
- All issuer controls behave correctly and are access-restricted
- Token is recognized as ERC-20 (balanceOf/allowance/events intact)
- Comprehensive token test suite green; gas snapshot recorded

---

## Phase 6 — End-to-End Flows & Full Test Suite

**Goal:** Prove the four canonical flows work together, with fuzzing and edge cases.

- 6.1 Flow A (Onboarding): claim issued → wallet registered → becomes eligible.
- 6.2 Flow B (Issuance): configure topics/issuers/rules → mint to verified investors.
- 6.3 Flow C (Transfer, the heart): verified→verified passes; unverified/rule-violating reverts with clear reasons.
- 6.4 Flow D (Corporate control): freeze, force-transfer recovery, pause.
- 6.5 Add fuzz tests (random amounts/holder counts) and boundary tests (exact max holders, exact balance cap).
- 6.6 `forge coverage`; ensure critical paths covered; `forge snapshot --check` in CI.

**Exit criteria**

- All four flows pass as integration tests in one suite
- Fuzz + boundary tests pass
- Coverage report generated; gas regression gate active in CI
- `FLOWS.md` documents each flow with the exact test that proves it

---

## Phase 7 — Deployment Pipeline (Local + Sepolia)

**Goal:** One reproducible command to deploy and configure the entire suite, locally and on a testnet.

- 7.1 Write a Foundry deploy script that deploys all contracts **in dependency order** and wires them together.
- 7.2 Post-deploy configuration: set claim topics, add trusted issuer, add compliance modules, set agents.
- 7.3 Parameterize via env; emit a `deployments/<network>.json` artifact of all addresses.
- 7.4 Deploy to Anvil, then Sepolia; verify contracts on Etherscan.
- 7.5 A `bootstrap` script that also onboards one demo investor + mints, for instant demos.

**Exit criteria**

- Single command deploys + configures the full suite on Anvil and Sepolia
- Deployed addresses saved to a machine-readable artifact
- Contracts verified on Sepolia Etherscan
- README documents the exact deploy + bootstrap steps

---

## Phase 8 — Backend Indexer & API (Cap Table)

**Goal:** Turn on-chain events into a queryable cap table and compliance view.

- 8.1 Define DB schema (Prisma): `investors`, `identities`, `tokens`, `holdings`, `events`, `freezes`.
- 8.2 Build a viem event indexer for `Transfer`, `Mint`/`Burn`, `AddressFrozen`, `TokensFrozen`, `Paused`, registry events.
- 8.3 Make the indexer idempotent + resumable (track last processed block; handle restarts).
- 8.4 Fastify REST API: `/holders`, `/captable`, `/tokens/:id`, `/investors/:addr/status`, `/events`, `/health`.
- 8.5 Basic reorg-safety: only index confirmed blocks (confirmation depth) for the testnet.

**Exit criteria**

- Indexer reconstructs the correct cap table from chain events
- API returns holders, cap table, per-investor verification/freeze status, and event feed
- Indexer is resumable and idempotent (safe to restart)
- Health/ready endpoints + structured logging

---

## Phase 9 — Issuer Admin Dashboard

**Goal:** The issuer product surface — deploy/configure tokens and manage investors and controls.

- 9.1 React + Vite app; wallet connect (wagmi + RainbowKit); network guard (Sepolia).
- 9.2 Token overview: name, supply, holder count, compliance status (from API).
- 9.3 Investor management: register/remove investor (wallet + ONCHAINID + country); see eligibility.
- 9.4 Controls: mint, burn, freeze address, freeze partial, pause/unpause, force-transfer — wired to contract calls.
- 9.5 Cap-table table + supply chart fed by the API; optimistic UI + tx status toasts.

**Exit criteria**

- Issuer can perform all admin actions from the UI against Sepolia
- Cap table + supply reflect chain state via the indexer/API
- All actions show pending/success/failure states
- Access-restricted actions fail gracefully for non-agents

---

## Phase 10 — Investor Portal & Simulated KYC

**Goal:** The investor product surface — get verified (simulated), view holdings, and transfer.

- 10.1 Simulated KYC form → backend acts as claim issuer → issues signed claim to the investor's ONCHAINID → registers wallet in Identity Registry.
- 10.2 Verification status view (which required claims the investor holds).
- 10.3 Holdings view (balance, frozen amount, token info) from the API.
- 10.4 Transfer UI to another investor, with **clear, human-readable revert reasons** ("recipient not verified", "exceeds holder limit", "country restricted", "token paused").
- 10.5 Empty/loading/error states; mobile-responsive layout.

**Exit criteria**

- A fresh wallet can complete simulated KYC and become eligible end-to-end
- Investor can view verification status + holdings
- verified→verified transfer succeeds from the UI; blocked transfers show the specific reason
- The full onboarding→transfer journey works without touching the CLI

---

## Phase 11 — Corporate Actions (Dividends & Recovery Demos)

**Goal:** Showcase the issuer features that make the standard compelling.

- 11.1 Deploy a mock stablecoin; implement a snapshot-based **dividend distribution** (pro-rata to holders at a block).
- 11.2 Investor "claim dividend" flow in the portal.
- 11.3 Recovery demo: simulate a compromised wallet → agent `forcedTransfer` to a recovery wallet.
- 11.4 Emergency demo: `pause` halts all transfers; `unpause` restores.
- 11.5 Tests + a scripted walkthrough for each corporate action.

**Exit criteria**

- Dividends distribute pro-rata and are claimable by holders
- Recovery (force-transfer) and pause/unpause demos work from the UI
- Each corporate action has a passing test and a documented demo step

---

## Phase 12 — Hardening, Docs & Demo

**Goal:** Ship-quality polish, documentation, and a repeatable demo.

- 12.1 Security pass: Slither + solhint clean; add NatSpec to all public functions; checks-effects-interactions review.
- 12.2 `README.md`: architecture diagram, one-command run, deploy + demo scripts, screenshots.
- 12.3 `THREAT_MODEL.md`: what the two gates protect against, known limitations, "KYC is simulated" honesty note.
- 12.4 Record a full demo: onboard investor → mint → compliant transfer → blocked transfer → freeze/pause → dividend.
- 12.5 Finalize `V2_BACKLOG.md`; tag `v1.0.0`.

**Exit criteria**

- Slither/solhint clean; NatSpec complete
- README + ARCHITECTURE + FLOWS + IDENTITY + THREAT_MODEL docs complete and accurate
- End-to-end recorded demo reproducible from a clean clone
- Repo tagged `v1.0.0`; V2 backlog captured

---

## Suggested Build Order (dependency-aware)

```text
Phase 0  (thin slice, prove the pipe)
Phase 1  (foundation + deps)
Phase 2  (identity + claims)      ─┐
Phase 3  (registries)             ─┤ contracts core
Phase 4  (compliance)             ─┤
Phase 5  (token + controls)       ─┘
Phase 6  (end-to-end tests)
Phase 7  (deploy local + Sepolia)
Phase 8  (indexer + API)
Phase 9  (issuer dashboard)       ─┐ product layer
Phase 10 (investor portal + KYC)  ─┤
Phase 11 (corporate actions)      ─┘
Phase 12 (harden + docs + demo)
```

## The One-Paragraph Anchor (keep this in the README)

> AssetGate is a permissioned security-token platform built on ERC-3643 (T-REX), where every transfer is gated by two on-chain checks — an Identity Registry (is the receiver a verified investor, proven by signed claims on their ONCHAINID from a trusted issuer?) and a Compliance module (does the transfer satisfy the rules — holder limits, country, balance caps, lockups?). If either fails, the transfer reverts. The platform is the product around that engine: issuers configure tokens and manage verified investors; investors get (simulated) KYC and hold/transfer; and compliance is enforced automatically on-chain — with the issuer controls regulators require: freeze, force-transfer, and pause.
