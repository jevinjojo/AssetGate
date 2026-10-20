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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="ok" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600 }}>
                <span>✓ Verified Investor</span>
              </div>
              <span style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", padding: "2px 8px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: 600 }}>
                ONCHAINID KYC
              </span>
            </div>
            <div>Required claim — KYC (Topic 1): <b>held & verified</b></div>
            <div>Jurisdiction: <b>ISO {status.country ?? "840"} (USA / Eligible)</b></div>
            <div className="mono small">
              Identity Contract:{" "}
              {status.identity ? (
                <a
                  href={`https://scan.botchain.ai/address/${status.identity}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "inherit", textDecoration: "underline" }}
                >
                  {status.identity.slice(0, 10)}…{status.identity.slice(-8)} ↗
                </a>
              ) : (
                "—"
              )}
            </div>
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
        <h3>Holdings & Escrow</h3>
        <div className="status-box">
          {(() => {
            const rawBalance = BigInt(status?.balance ?? "0");
            const rawFrozen = BigInt(status?.frozenTokens ?? "0");
            const rawLiquid = rawBalance > rawFrozen ? rawBalance - rawFrozen : 0n;
            const balanceStr = formatUnits(rawBalance, decimals);
            const frozenStr = formatUnits(rawFrozen, decimals);
            const liquidStr = formatUnits(rawLiquid, decimals);
            const isFrozen = status?.frozen === true;
            const hasFrozenTokens = rawFrozen > 0n;

            return (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "1.05rem", fontWeight: 700 }}>
                    {token?.name} ({token?.symbol})
                  </span>
                  {isFrozen ? (
                    <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "3px 10px", borderRadius: "9999px", fontSize: "0.80rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      🔒 Wallet Frozen
                    </span>
                  ) : hasFrozenTokens ? (
                    <span style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", padding: "3px 10px", borderRadius: "9999px", fontSize: "0.80rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      🔒 Partial Escrow Active
                    </span>
                  ) : (
                    <span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", padding: "3px 10px", borderRadius: "9999px", fontSize: "0.80rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      🔓 Fully Liquid
                    </span>
                  )}
                </div>

                <div className="grid2" style={{ gap: "0.75rem", marginTop: "0.5rem" }}>
                  <div style={{ background: "#ffffff", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Total Balance</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: "2px" }}>{balanceStr} <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{token?.symbol ?? "AGT"}</span></div>
                  </div>
                  <div style={{ background: "#ffffff", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Liquid (Transferable)</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#16a34a", marginTop: "2px" }}>{liquidStr} <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{token?.symbol ?? "AGT"}</span></div>
                  </div>
                </div>

                {hasFrozenTokens && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "0.6rem 0.8rem", fontSize: "0.85rem", color: "#92400e", display: "flex", alignItems: "center", gap: "6px", marginTop: "0.25rem" }}>
                    <span>🔒 <b>{frozenStr} {token?.symbol ?? "AGT"}</b> locked in regulatory escrow. Only <b>{liquidStr} {token?.symbol ?? "AGT"}</b> is transferable.</span>
                  </div>
                )}

                {isFrozen && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.6rem 0.8rem", fontSize: "0.85rem", color: "#991b1b", display: "flex", alignItems: "center", gap: "6px", marginTop: "0.25rem" }}>
                    <span>⛔ <b>Wallet Frozen:</b> Compliance lock active. Outbound and inbound transfers are halted at Gate 2.</span>
                  </div>
                )}
              </>
            );
          })()}
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