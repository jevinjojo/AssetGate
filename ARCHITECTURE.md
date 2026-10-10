# AssetGate — Architecture

AssetGate is a permissioned **security-token** platform built on **ERC-3643 (T-REX)**.
Its defining property: **every transfer is gated on-chain**. A normal ERC-20 transfer just
moves balances. An ERC-3643 transfer first asks _"is this allowed?"_ and **reverts** if not.

## The Two-Gate Transfer Model

On every `transfer` / `transferFrom` / `mint`, the token runs two checks:

```text
        Alice (verified) --transfer--> Bob
                     |
                     v
        ┌─────────────────────────────┐
   GATE 1: Identity Registry           │  Is Bob a verified investor?
        │  - Is Bob registered?        │  (registered wallet + ONCHAINID
        │  - Does his ONCHAINID hold   │   holding all required claims,
        │    all required claims,      │   signed by a trusted issuer)
        │    signed by a trusted issuer?│
        └─────────────────────────────┘
                     |
                     v
        ┌─────────────────────────────┐
   GATE 2: Modular Compliance          │  Does this transfer satisfy the rules?
        │  - max holders?              │  (holder cap, per-investor balance
        │  - per-wallet cap?           │   cap, country limits, lockups…)
        │  - country allowed?          │
        └─────────────────────────────┘
                     |
          both pass ─┴─ either fails
              |            |
           SUCCESS       REVERT
```

If **either** gate fails, the whole transaction reverts. That is the entire security model.

## The 5 Core Contracts

| #   | Contract                     | Responsibility                                                                                                                                                                                                                                                                                                    | T-REX path                                                 |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | **Token**                    | ERC-20-compatible token whose transfer is overridden to consult Gate 1 + Gate 2 before moving balances. Also holds the privileged issuer controls regulators require: `freeze`, `freezePartialTokens`, `forcedTransfer`, `pause`, `mint`, `burn`.                                                                 | `contracts/token/IToken.sol`                               |
| 2   | **Identity Registry**        | The "who may hold this token" list. Maps each investor wallet → their ONCHAINID + country, and answers `isVerified(address)` by checking that their identity holds all required claims from trusted issuers. Backed by a shared **Identity Registry Storage** so multiple tokens can reuse one investor registry. | `contracts/registry/interface/IIdentityRegistry.sol`       |
| 3   | **Modular Compliance**       | The configurable rulebook. Plug in rule **modules** (max holders, max balance per investor, country restrictions, lockups). Answers `canTransfer(from,to,amount)` by running every active module, and keeps bookkeeping (`transferred`/`created`/`destroyed`) so holder counts stay accurate.                     | `contracts/compliance/modular/IModularCompliance.sol`      |
| 4   | **Trusted Issuers Registry** | The list of _who is allowed to issue verification claims_ (e.g., "KYC provider Acme may attest KYC"). Stops self-issued or forged claims from counting.                                                                                                                                                           | `contracts/registry/interface/ITrustedIssuersRegistry.sol` |
| 5   | **Claim Topics Registry**    | The list of _which claims are required_ to hold this token (e.g., topic 1 = KYC, topic 2 = accredited investor).                                                                                                                                                                                                  | `contracts/registry/interface/IClaimTopicsRegistry.sol`    |

## ONCHAINID (ERC-734/735) — the identity layer

- Each investor has their own **identity smart contract** (their ONCHAINID). Identity ≠ wallet.
- It holds **claims**: signed statements like "passed KYC", "is accredited", "resident of allowed country".
- Each claim has a **topic** (what), an **issuer** (who vouches), a **signature** (cryptographic proof), and optional data.
- **Privacy**: claims store an _attestation_, not personal data. The PII stays off-chain with the KYC provider. You get verifiable compliance without doxxing everyone on a public ledger.

| Piece                             | ONCHAINID path                                   |
| --------------------------------- | ------------------------------------------------ |
| Identity interface                | `contracts/interface/IIdentity.sol`              |
| Claim issuer                      | `contracts/interface/IClaimIssuer.sol`           |
| ERC-734 (keys) / ERC-735 (claims) | `contracts/interface/IERC734.sol`, `IERC735.sol` |

## The actors

- **Claim Issuer (KYC provider)** — verifies a person off-chain, then issues a signed claim to their ONCHAINID. In AssetGate V1 this is **simulated** — we act as our own trusted issuer.
- **Investor** — controls their ONCHAINID and holds/transfers the token.
- **Issuer / Agent** — configures required claim topics + trusted issuers, sets compliance rules, mints, and operates freeze / force-transfer / pause.

## Implementation Summary

ERC-3643 provides a permissioned security-token standard where every transfer is strictly gated by two conditions: an Identity Registry (verifying the receiver as a compliant investor via signed claims on their ONCHAINID) and a Modular Compliance module (ensuring the transfer adheres to holder limits, country restrictions, and balance caps). If either condition is not met, the transaction reverts at the contract level. AssetGate implements this engine to provide a fully compliant, production-ready tokenization platform.
