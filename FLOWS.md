# AssetGate — End-to-End Flows

Every flow is proven by an integration test in `test/EndToEnd.t.sol`.

## Flow A — Onboarding

Claim issued → wallet registered → becomes eligible.

- KYC claim signed by the trusted issuer is added to the investor's ONCHAINID, then
  the agent registers `wallet → ONCHAINID → country` in the Identity Registry.
- **Proven by:** `test_FlowA_Onboarding` (verified alice/dave true, un-onboarded eve false).

## Flow B — Issuance

Configure topics/issuers/rules → mint to verified investors.

- Required claim topic (KYC) + trusted issuer + compliance modules are configured, then
  the agent mints to a verified wallet. Minting to an unverified wallet reverts.
- **Proven by:** `test_FlowB_IssuanceToVerified`, `test_FlowB_MintToUnverifiedReverts`.

## Flow C — Transfer (the heart)

verified→verified passes; unverified / rule-violating reverts.

- `verified → verified`: passes both gates.
- `verified → unverified`: fails **Gate 1 (identity)** — recipient not in the registry.
- `verified → verified-but-restricted-country`: passes Gate 1 but fails **Gate 2 (compliance)**.
- **Proven by:** `test_FlowC_VerifiedToVerifiedPasses`, `test_FlowC_ToUnverifiedReverts`,
  `test_FlowC_CountryRestrictedReverts`.

## Flow D — Corporate control

Freeze, force-transfer recovery, pause.

- Freezing blocks the sender; the agent recovers funds via `forcedTransfer` (bypasses
  freeze + compliance, still requires a verified recipient); pause halts all transfers.
- **Proven by:** `test_FlowD_FreezeForceTransferPause`.

## Boundary & Fuzz (6.5)

- **Exact holder cap:** `test_Boundary_HolderCapExact` (cap = 2; the 3rd new holder reverts).
- **Exact balance cap:** `test_Boundary_BalanceCapExact` (recipient at cap; +1 reverts).
- **Fuzz transfers:** `testFuzz_VerifiedTransferUpdatesBalances` (random valid amounts).
- **Fuzz negative:** `testFuzz_TransferToUnverifiedAlwaysReverts` (any amount to unverified reverts).

## The three compliance modules exercised

| Module                  | Rule                        | Type                                   |
| ----------------------- | --------------------------- | -------------------------------------- |
| `MaxHolderCountModule`  | ≤ N distinct holders        | custom, stateful (bookkeeping hooks)   |
| `BalanceCapModule`      | ≤ N tokens per wallet       | custom, reads live token balance       |
| `CountryRestrictModule` | allow-listed countries only | custom, reads IdentityRegistry country |
