import { useEffect, useState } from "react";
import { getCapTable, getHealth, type CapTable } from "../api";

export function TokenOverview() {
  const [ct, setCt] = useState<CapTable | null>(null);
  const [block, setBlock] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    const load = async () => {
      try {
        const [c, h] = await Promise.all([getCapTable(), getHealth()]);
        if (!on) return;
        setCt(c); setBlock(h.lastIndexedBlock); setErr(null);
      } catch (e) { if (on) setErr(e instanceof Error ? e.message : "error"); }
    };
    load(); const id = setInterval(load, 3000);
    return () => { on = false; clearInterval(id); };
  }, []);

  if (err) return <p className="error">API error: {err} — is the backend running?</p>;
  if (!ct) return <p className="muted">Loading token…</p>;

  return (
    <div className="cards">
      <div className="card"><span className="label">Token</span><span className="value">{ct.name} ({ct.symbol})</span></div>
      <div className="card"><span className="label">Total Supply</span><span className="value">{Number(ct.totalSupplyFormatted).toLocaleString()}</span></div>
      <div className="card"><span className="label">Holders</span><span className="value">{ct.holderCount}</span></div>
      <div className="card"><span className="label">Status</span><span className="value">{ct.paused ? "⏸ Paused" : "▶ Active"}</span></div>
      <div className="card"><span className="label">Indexed block</span><span className="value">#{block}</span></div>
    </div>
  );
}