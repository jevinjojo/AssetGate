import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { config } from "../config";
import { tokenTransferAbi } from "../abis";
import { useContractAction } from "../hooks";
import { TxStatus } from "./TxStatus";
import { getStatus, getCapTable, postKyc, preflight, type Status, type CapTable } from "../api";

import { ClaimDividend } from "./ClaimDividend";


export function InvestorPortal() {
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState<Status | null>(null);
  const [token, setToken] = useState<CapTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [country, setCountry] = useState("840");
  const [kycBusy, setKycBusy] = useState(false);

  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const tx = useContractAction();

  const refresh = async () => {
    if (!address) return;
    try {
      const [s, c] = await Promise.all([getStatus(address), getCapTable()]);
      setStatus(s); setToken(c); setErr(null);
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!isConnected) { setLoading(false); return; }
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [address, isConnected]);

  if (!isConnected) return <p className="muted">Connect your wallet to access the investor portal.</p>;
  if (loading) return <p className="muted">Loading…</p>;
  if (err) return <p className="error">API error: {err}</p>;

  const decimals = token?.decimals ?? 18;

  const doKyc = async () => {
    setKycBusy(true);
    try { await postKyc(address!, Number(country)); await refresh(); }
    catch (e) { setErr(e instanceof Error ? e.message : "KYC failed"); }
    finally { setKycBusy(false); }
  };

  const doTransfer = async () => {
    setReason(null);
    try {
      const pf = await preflight(address!, to, parseUnits(amt || "0", decimals).toString());
      if (!pf.allowed) { setReason(pf.reason); return; } // 10.4 clear reason, no failed tx
      tx.writeContract({ address: config.token, abi: tokenTransferAbi, functionName: "transfer", args: [to as `0x${string}`, parseUnits(amt, decimals)] });
    } catch (e) { setReason(e instanceof Error ? e.message : "preflight failed"); }
  };

  return (
    <div className="stack">
      <section className="panel">
        <h3>Verification</h3>
        {status?.verified ? (
          <div className="status-box">
            <div className="ok">✓ Verified investor</div>
            <div>Required claim — KYC: <b>held</b></div>
            <div>Country: <b>{status.country ?? "—"}</b></div>
            <div className="mono small">ONCHAINID: {status.identity ?? "—"}</div>
          </div>
        ) : (
          <>
            <p className="muted">You are not verified yet. Complete simulated KYC to become eligible.</p>
            <input placeholder="Country (ISO numeric, e.g. 840)" value={country} onChange={(e) => setCountry(e.target.value)} />
            <button onClick={doKyc} disabled={kycBusy}>{kycBusy ? "Processing KYC…" : "Complete KYC"}</button>
          </>
        )}
      </section>

      <section className="panel">
        <h3>Holdings</h3>
        <div className="status-box">
          <div>{token?.name} ({token?.symbol})</div>
          <div>Balance: <b>{formatUnits(BigInt(status?.balance ?? "0"), decimals)}</b> {token?.symbol}</div>
          <div>Frozen tokens: <b>{formatUnits(BigInt(status?.frozenTokens ?? "0"), decimals)}</b></div>
          <div>Wallet frozen: <b>{status?.frozen ? "yes" : "no"}</b></div>
        </div>
      </section>

      <section className="panel">
        <h3>Transfer</h3>
        {!status?.verified ? (
          <p className="muted">Complete KYC first to transfer.</p>
        ) : (
          <>
            <input placeholder="Recipient (0x…)" value={to} onChange={(e) => setTo(e.target.value)} />
            <input placeholder={`Amount (${token?.symbol ?? "AGT"})`} value={amt} onChange={(e) => setAmt(e.target.value)} />
            <button onClick={doTransfer} disabled={tx.isPending || tx.isConfirming}>Send</button>
            {reason && <p className="error">⛔ {reason}</p>}
            <TxStatus {...tx} />
          </>
        )}
      </section>
      {status?.verified && <ClaimDividend />}
    </div>
  );
}