# AssetGate — Threat Model

AssetGate is an **educational/portfolio** implementation of the ERC-3643 security-token
standard. This document states what it protects against, who is trusted, and its known limits.

## The two gates — what they protect against

| Gate                                   | Enforces                                                           | Prevents                                                                              |
| -------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **Identity Registry** (`isVerified`)   | recipient has a valid, trusted-issuer KYC claim on their ONCHAINID | tokens landing with unverified/unknown wallets (the ERC-20 "anyone can hold" problem) |
| **Modular Compliance** (`canTransfer`) | holder cap, per-wallet balance cap, country allow-list             | over-concentration, too many holders, transfers into restricted jurisdictions         |

A transfer must pass **both**; `mint` and `forcedTransfer` bypass compliance but **still require a verified recipient**.

## Trust model / roles

- **Owner** — deploys and configures the token, registries, and compliance.
- **Agent** — can mint, burn, freeze, force-transfer, pause. **Highly privileged by design** (regulators require recoverability).
- **Trusted Issuer** — the only party whose signed claims make a wallet verifiable. In V1 this is **simulated** (we are our own issuer).

Users must trust that owner/agent keys are held securely. Agent power is a **feature** (court-ordered recovery, incident response), not a bug — but it is centralization.

## Attacker scenarios & mitigations

| Scenario                                           | Mitigation                                                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Send tokens to an unverified wallet                | `isVerified(to)` gate reverts the transfer                                                                       |
| Forge a KYC claim                                  | `ClaimIssuer.isClaimValid` recovers the signer and checks it holds a CLAIM key; untrusted/forged signatures fail |
| Bypass holder/country/balance limits               | each is an independent `moduleCheck` in `canTransfer`; any `false` blocks                                        |
| Reentrancy on dividend claim                       | checks-effects-interactions: `hasClaimed` set before payout `transfer`                                           |
| Double-claim a dividend                            | `hasClaimed[id][account]` guard + Merkle proof uniqueness                                                        |
| Manipulate the cap table via the indexer           | idempotent (`unique(txHash,logIndex)`), resumable (`lastBlock`), reorg-safe (`confirmations` depth)              |
| Front-run / grief with a reorg’d dividend snapshot | snapshots taken against confirmed blocks; root is immutable once posted                                          |

## Known limitations

- **KYC is simulated.** We act as our own trusted issuer; no real identity verification occurs.
- **Issuer key in the backend.** The Phase 10 KYC endpoint signs claims with the issuer key held in backend env — acceptable for a demo, **unacceptable for production** (use a KMS/HSM + a licensed KYC vendor).
- **Agent centralization.** Freeze/force-transfer/pause give the agent broad control. Mitigate in production with a multisig/timelock and public policy.
- **Not audited.** The custom modules + dividend distributor have tests but no third-party audit.
- **Single-token indexer.** The backend indexes one token; multi-token is V2.
- **Dividend dust.** Pro-rata flooring leaves tiny remainders in the distributor (recoverable in V2).

## Out of scope

Real securities law/registration, fiat rails/custody, secondary market/DEX, cross-chain, and
anything in `V2_BACKLOG.md`. **This is not legal or financial advice.**
