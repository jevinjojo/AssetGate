import { useState } from "react";
import { parseUnits } from "viem";
import { config } from "../config";
import { identityRegistryAbi } from "../abis";
import { useContractAction } from "../hooks";
import { TxStatus } from "./TxStatus";
import { getStatus, type Status } from "../api";

export function InvestorManager() {
  const reg = useContractAction();
  const [wallet, setWallet] = useState("");
  const [identity, setIdentity] = useState("");
  const [country, setCountry] = useState("840");

  const del = useContractAction();
  const [removeWallet, setRemoveWallet] = useState("");

  const [lookup, setLookup] = useState("");
  const [status, setStatus] = useState<Status | null>(null);

  const register = () =>
    reg.writeContract({
      address: config.identityRegistry, abi: identityRegistryAbi, functionName: "registerIdentity",
      args: [wallet as `0x${string}`, identity as `0x${string}`, Number(country)],
    });

  const remove = () =>
    del.writeContract({
      address: config.identityRegistry, abi: identityRegistryAbi, functionName: "deleteIdentity",
      args: [removeWallet as `0x${string}`],
    });

  return (
    <div className="stack">
      <section className="panel">
        <h3>Register investor</h3>
        <input placeholder="Investor wallet (0x…)" value={wallet} onChange={(e) => setWallet(e.target.value)} />
        <input placeholder="ONCHAINID address (0x…)" value={identity} onChange={(e) => setIdentity(e.target.value)} />
        <input placeholder="Country (ISO numeric, e.g. 840)" value={country} onChange={(e) => setCountry(e.target.value)} />
        <button onClick={register} disabled={reg.isPending || reg.isConfirming}>Register</button>
        <TxStatus {...reg} />
      </section>

      <section className="panel">
        <h3>Remove investor</h3>
        <input placeholder="Investor wallet (0x…)" value={removeWallet} onChange={(e) => setRemoveWallet(e.target.value)} />
        <button onClick={remove} disabled={del.isPending || del.isConfirming}>Delete identity</button>
        <TxStatus {...del} />
      </section>

      <section className="panel">
        <h3>Check eligibility</h3>
        <input placeholder="Wallet (0x…)" value={lookup} onChange={(e) => setLookup(e.target.value)} />
        <button onClick={async () => setStatus(await getStatus(lookup))}>Look up</button>
        {status && (
          <div className="status-box">
            <div>Verified: <b>{status.verified ? "yes" : "no"}</b></div>
            <div>Frozen: <b>{status.frozen ? "yes" : "no"}</b></div>
            <div>Balance: <b>{status.balance}</b></div>
            <div>Country: <b>{status.country ?? "—"}</b></div>
            <div className="mono">ONCHAINID: {status.identity ?? "—"}</div>
          </div>
        )}
      </section>
    </div>
  );
}