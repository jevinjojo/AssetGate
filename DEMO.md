# AssetGate — Demo Script (Sepolia)

**Setup:** backend + frontend running against Sepolia (`VITE_CHAIN_ID=11155111` and the Sepolia
addresses from `deployments/sepolia.json` + `deployments/sepolia-dividends.json`). MetaMask with
three accounts: **Issuer** (deployer/agent), **Investor A** (holds AGT), **Investor B** (fresh).

Target length ~5 min. Narrate the "why" at each step.

1. **Overview** — Issuer tab → Overview. Show token name/supply/holders, and the cap table fed by
   the indexer. _"Reads come from our indexer, writes go to the chain."_
2. **Onboard (simulated KYC)** — switch MetaMask to **Investor B** → Investor tab → Complete KYC.
   _"The backend deploys B's ONCHAINID, signs a KYC claim as the trusted issuer, and registers it."_
   Status flips to ✓ Verified.
3. **Issue** — switch to **Issuer** → Controls → Mint 500 AGT to Investor B. Cap table updates in ~3s.
4. **Compliant transfer** — switch to **Investor A** → Investor → transfer to Investor B → succeeds.
5. **Blocked transfer** — transfer to a random unverified address → UI shows
   **"The recipient is not a verified investor."** (no failed tx sent — preflight caught it).
6. **Freeze / recovery** — Issuer → Controls → freeze Investor A → A's transfer now reverts
   ("Your wallet is frozen") → `forcedTransfer` from A to a recovery wallet succeeds.
7. **Pause** — Issuer → pause → any investor transfer shows "token is paused" → unpause.
8. **Dividend** — Issuer → Dividends → Prepare (1000) → Approve → Create. Switch to a holder →
   Investor → Claim dividend (id 0) → mUSDC arrives.

**Recording tips:** OBS/Loom at 1080p; pre-fund all three MetaMask accounts with Sepolia ETH;
keep the backend logs visible in a side panel to show events being indexed live.
