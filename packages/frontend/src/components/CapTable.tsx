import { useEffect, useState } from "react";
import { getCapTable, type Holder } from "../api";

export function CapTable() {
  const [holders, setHolders] = useState<Holder[] | null>(null);

  useEffect(() => {
    let on = true;
    const load = async () => { try { const c = await getCapTable(); if (on) setHolders(c.holders); } catch { /* ignore */ } };
    load(); const id = setInterval(load, 3000);
    return () => { on = false; clearInterval(id); };
  }, []);

  if (!holders) return <p className="muted">Loading cap table…</p>;
  if (holders.length === 0) return <p className="muted">No holders yet.</p>;

  return (
    <table>
      <thead><tr><th>#</th><th>Address</th><th>Balance</th><th>%</th><th>Frozen</th></tr></thead>
      <tbody>
        {holders.map((h, i) => (
          <tr key={h.address}>
            <td>{i + 1}</td>
            <td className="mono">{h.address}</td>
            <td>{Number(h.balanceFormatted).toLocaleString()}</td>
            <td>{h.percentage.toFixed(2)}%</td>
            <td>{h.frozen ? "🔒 all" : h.frozenTokens !== "0" ? `partial` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}