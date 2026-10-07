import { useState } from "react";
import { parseUnits } from "viem";
import { config } from "../config";
import { mockUsdcAbi, distributorAbi } from "../abis";
import { useContractAction } from "../hooks";
import { TxStatus } from "./TxStatus";
import { prepareDividend } from "../api";

export function IssuerDividends() {
  const [total, setTotal] = useState("");
  const [prep, setPrep] = useState<{ root: string; total: string; recipients: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const approve = useContractAction();
  const create = useContractAction();

  const doPrepare = async () => {
    setBusy(true);
    try { setPrep(await prepareDividend(parseUnits(total || "0", 18).toString())); }
    finally { setBusy(false); }
  };

  return (
    <section className="panel">
      <h3>Create dividend distribution</h3>
      <input placeholder="Total payout (mUSDC)" value={total} onChange={(e) => setTotal(e.target.value)} />
      <button onClick={doPrepare} disabled={busy}>{busy ? "Snapshotting…" : "1 · Prepare (snapshot cap table)"}</button>
      {prep && (
        <div className="status-box">
          <div>Recipients: <b>{prep.recipients}</b></div>
          <div className="mono small">root: {prep.root.slice(0, 20)}…</div>
          <div>Funded (wei): <b>{prep.total}</b></div>
          <button onClick={() => approve.writeContract({ address: config.mockUsdc, abi: mockUsdcAbi, functionName: "approve", args: [config.distributor, BigInt(prep.total)] })}
            disabled={approve.isPending || approve.isConfirming}>2 · Approve mUSDC</button>
          <TxStatus {...approve} />
          <button onClick={() => create.writeContract({ address: config.distributor, abi: distributorAbi, functionName: "createDistribution", args: [prep.root as `0x${string}`, BigInt(prep.total)] })}
            disabled={create.isPending || create.isConfirming}>3 · Create distribution</button>
          <TxStatus {...create} />
        </div>
      )}
    </section>
  );
}