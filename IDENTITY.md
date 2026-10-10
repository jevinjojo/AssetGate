# AssetGate — Identity & Claims (ONCHAINID)

ERC-3643 answers "is this person allowed to hold the token?" by delegating to **ONCHAINID**
(ERC-734 keys + ERC-735 claims). This document explains the identity model.

## Identity ≠ wallet

Each investor has their own **Identity contract** (their ONCHAINID). It is separate from any
wallet. The identity is what _holds verifications_; wallets are merely keys that can act on it.

## Keys (ERC-734)

An identity has keys, each with a **purpose**:

| Purpose | Meaning    | Used for                             |
| ------: | ---------- | ------------------------------------ |
|       1 | MANAGEMENT | add/remove keys, manage the identity |
|       3 | CLAIM      | sign/add claims                      |

A key is stored as `keccak256(abi.encode(address))` with a key type (1 = ECDSA). To let an
address sign valid claims for a `ClaimIssuer`, its address must hold a **CLAIM key (purpose 3)**
on that issuer.

## Claims (ERC-735)

A **claim** is a signed statement about an identity. Its parts:

| Field       | Meaning                                              |
| ----------- | ---------------------------------------------------- |
| `topic`     | _what_ the claim asserts (our convention: `1` = KYC) |
| `scheme`    | signature scheme (`1` = ECDSA)                       |
| `issuer`    | the ClaimIssuer contract that vouches for it         |
| `signature` | the issuer key's signature over the claim hash       |
| `data`      | claim payload (attestation, **not** raw PII)         |
| `uri`       | optional pointer to off-chain detail                 |

Stored on the identity via:

```solidity
addClaim(topic, scheme, issuer, signature, data, uri);
```

The claim id is deterministic: `keccak256(abi.encode(issuer, topic))` — so a newer claim from the
same issuer on the same topic overwrites the old one.

## The signature scheme

The issuer signs:

```text
message  = keccak256(abi.encode(identityAddress, topic, data))
prefixed = keccak256("\x19Ethereum Signed Message:\n32" ++ message)
signature = sign(issuerPrivKey, prefixed)
```

Verification (`ClaimIssuer.isClaimValid`) recovers the signer from `signature` and checks that
the recovered address holds a **CLAIM key** on the issuer. If either the hash doesn't match
(tampered sig / changed data) or the signer isn't a claim key (untrusted issuer) → **false**.

## The on-chain / off-chain PII boundary

The claim `data` stores an **attestation**, not the person's name or passport. The real PII
lives off-chain with the KYC provider. So the chain proves _"a trusted issuer confirms this
identity meets requirement X"_ without publishing personal data on a public ledger — compliance
**and** privacy.

## Implementation Details

The KYC provider is **simulated**: we deploy our own `ClaimIssuer` and sign test claims. A real
deployment integrates a licensed KYC vendor as the trusted issuer. Everything else — the keys,
claims, hashing, and verification path — is the genuine standard.
