import { useState } from "react";
import { parseUnits } from "viem";
import { config } from "../config";
import { tokenAbi } from "../abis";
import { useContractAction } from "../hooks";
import { TxStatus } from "./TxStatus";

const DECIMALS = 18;

export function IssuerControls() {
  const mint = useContractAction();
  const [mintTo, setMintTo] = useState(""); const [mintAmt, setMintAmt] = useState("");

  const burn = useContractAction();
  const [burnFrom, setBurnFrom] = useState(""); const [burnAmt, setBurnAmt] = useState("");

  const freeze = useContractAction();
  const [freezeAddr, setFreezeAddr] = useState("");

  const partial = useContractAction();
  const [partialAddr, setPartialAddr] = useState(""); const [partialAmt, setPartialAmt] = useState("");

  const forced = useContractAction();
  const [fFrom, setFFrom] = useState(""); const [fTo, setFTo] = useState(""); const [fAmt, setFAmt] = useState("");

  const pause = useContractAction();
  const agent = useContractAction();
  const [agentAddr, setAgentAddr] = useState("");

  const T = config.token;
  const IR = config.identityRegistry;
  const amt = (v: string) => parseUnits(v || "0", DECIMALS);

  return (
    <div className="grid2">
      <section className="panel">
        <h3>Mint</h3>
        <input placeholder="To (0x…)" value={mintTo} onChange={(e) => setMintTo(e.target.value)} />
        <input placeholder="Amount (AGT)" value={mintAmt} onChange={(e) => setMintAmt(e.target.value)} />
        <button disabled={mint.isPending || mint.isConfirming}
          onClick={() => mint.writeContract({ address: T, abi: tokenAbi, functionName: "mint", args: [mintTo as `0x${string}`, amt(mintAmt)] })}>Mint</button>
        <TxStatus {...mint} />
      </section>

      <section className="panel">
        <h3>Burn</h3>
        <input placeholder="From (0x…)" value={burnFrom} onChange={(e) => setBurnFrom(e.target.value)} />
        <input placeholder="Amount (AGT)" value={burnAmt} onChange={(e) => setBurnAmt(e.target.value)} />
        <button disabled={burn.isPending || burn.isConfirming}
          onClick={() => burn.writeContract({ address: T, abi: tokenAbi, functionName: "burn", args: [burnFrom as `0x${string}`, amt(burnAmt)] })}>Burn</button>
        <TxStatus {...burn} />
      </section>

      <section className="panel">
        <h3>Freeze / unfreeze address</h3>
        <input placeholder="Wallet (0x…)" value={freezeAddr} onChange={(e) => setFreezeAddr(e.target.value)} />
        <div className="row">
          <button disabled={freeze.isPending || freeze.isConfirming}
            onClick={() => freeze.writeContract({ address: T, abi: tokenAbi, functionName: "setAddressFrozen", args: [freezeAddr as `0x${string}`, true] })}>Freeze</button>
          <button disabled={freeze.isPending || freeze.isConfirming}
            onClick={() => freeze.writeContract({ address: T, abi: tokenAbi, functionName: "setAddressFrozen", args: [freezeAddr as `0x${string}`, false] })}>Unfreeze</button>
        </div>
        <TxStatus {...freeze} />
      </section>

      <section className="panel">
        <h3>Freeze partial tokens</h3>
        <input placeholder="Wallet (0x…)" value={partialAddr} onChange={(e) => setPartialAddr(e.target.value)} />
        <input placeholder="Amount (AGT)" value={partialAmt} onChange={(e) => setPartialAmt(e.target.value)} />
        <button disabled={partial.isPending || partial.isConfirming}
          onClick={() => partial.writeContract({ address: T, abi: tokenAbi, functionName: "freezePartialTokens", args: [partialAddr as `0x${string}`, amt(partialAmt)] })}>Freeze partial</button>
        <TxStatus {...partial} />
      </section>

      <section className="panel">
        <h3>Forced transfer (recovery)</h3>
        <input placeholder="From (0x…)" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
        <input placeholder="To (0x…)" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        <input placeholder="Amount (AGT)" value={fAmt} onChange={(e) => setFAmt(e.target.value)} />
        <button disabled={forced.isPending || forced.isConfirming}
          onClick={() => forced.writeContract({ address: T, abi: tokenAbi, functionName: "forcedTransfer", args: [fFrom as `0x${string}`, fTo as `0x${string}`, amt(fAmt)] })}>Force transfer</button>
        <TxStatus {...forced} />
      </section>

      <section className="panel">
        <h3>Pause / unpause</h3>
        <div className="row">
          <button disabled={pause.isPending || pause.isConfirming}
            onClick={() => pause.writeContract({ address: T, abi: tokenAbi, functionName: "pause", args: [] })}>Pause</button>
          <button disabled={pause.isPending || pause.isConfirming}
            onClick={() => pause.writeContract({ address: T, abi: tokenAbi, functionName: "unpause", args: [] })}>Unpause</button>
        </div>
        <TxStatus {...pause} />
      </section>

      <section className="panel">
        <h3>Agent roles (Admin)</h3>
        <input placeholder="Wallet (0x…)" value={agentAddr} onChange={(e) => setAgentAddr(e.target.value)} />
        <div className="row">
          <button disabled={agent.isPending || agent.isConfirming}
            onClick={() => agent.writeContract({ address: T, abi: tokenAbi, functionName: "addAgent", args: [agentAddr as `0x${string}`] })}>Grant Agent</button>
          <button disabled={agent.isPending || agent.isConfirming}
            onClick={() => agent.writeContract({ address: T, abi: tokenAbi, functionName: "removeAgent", args: [agentAddr as `0x${string}`] })}>Remove Agent</button>
        </div>
        <TxStatus {...agent} />
      </section>
    </div>
  );
}