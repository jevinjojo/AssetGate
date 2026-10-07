import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { config } from "../config";
import { distributorAbi } from "../abis";
import { useContractAction } from "../hooks";
import { TxStatus } from "./TxStatus";
import { dividendProof } from "../api";

export function ClaimDividend() {
  const { address } = useAccount();
  const [id, setId] = useState("0");
  const [info, setInfo] = useState<string | null>(null);
  const claim = useContractAction();

  const { data: dist } = useReadContract({
    address: config.distributor, abi: distributorAbi, functionName: "distributions",
    args: [BigInt(id || "0")], query: { enabled: !!config.distributor },
  });
  const root = Array.isArray(dist) ? (dist[0] as string) : undefined;

  const doClaim = async () => {
    setInfo(null);
    if (!root || !address) { setInfo("No distribution for that id."); return; }
    try {
      const { amount, proof } = await dividendProof(root, address);
      claim.writeContract({ address: config.distributor, abi: distributorAbi, functionName: "claim", args: [BigInt(id), BigInt(amount), proof as `0x${string}`[]] });
    } catch { setInfo("You have no allocation in this distribution."); }
  };

  return (
    <section className="panel">
      <h3>Claim dividend</h3>
      <input placeholder="Distribution id (e.g. 0)" value={id} onChange={(e) => setId(e.target.value)} />
      <button onClick={doClaim} disabled={claim.isPending || claim.isConfirming}>Claim</button>
      {info && <p className="muted">{info}</p>}
      <TxStatus {...claim} />
    </section>
  );
}