# AssetGate — Corporate Actions

## 1. Dividends (snapshot-based, pro-rata, Merkle claim)

1. **Issuer → Dividends tab → Prepare:** backend snapshots the current cap table (from the
   indexer), computes each holder's pro-rata share of the total, and builds an OpenZeppelin
   `StandardMerkleTree` of `(holder, amount)`. Returns the root + funded total.
2. **Issuer → Approve mUSDC → Create distribution:** approves the payout token and calls
   `createDistribution(root, total)`, which pulls the mUSDC into the distributor.
3. **Investor → Portal → Claim dividend:** enters the distribution id; the UI reads the root
   on-chain, fetches the holder's proof from the backend, and calls `claim(id, amount, proof)`.

- **Tests:** `test/Dividend.t.sol` — `test_ProRataClaim`, `test_DoubleClaimReverts`, `test_InvalidProofReverts`.

## 2. Recovery (compromised wallet)

Issuer → Controls → freeze the wallet, then `forcedTransfer(compromised, recovery, amount)`.
Force-transfer bypasses the freeze **and** compliance, but still requires a verified recipient.

- **Test:** `test/EndToEnd.t.sol::test_FlowD_FreezeForceTransferPause`.

## 3. Emergency pause

Issuer → Controls → `pause()` halts all peer transfers; `unpause()` restores them.

- **Test:** `test/EndToEnd.t.sol::test_FlowD_FreezeForceTransferPause` (pause branch).
