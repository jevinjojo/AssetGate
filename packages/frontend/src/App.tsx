import { useEffect, useState } from "react";
import {
  fetchHolders,
  fetchHealth,
  type HoldersResponse,
  type Health,
} from "./api";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatBig(raw: string) {
  const whole = BigInt(raw) / 10n ** 18n;
  return whole.toLocaleString();
}

export default function App() {
  const [data, setData] = useState<HoldersResponse | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [holders, hp] = await Promise.all([fetchHolders(), fetchHealth()]);
        if (!active) return;
        setData(holders);
        setHealth(hp);
        setError(null);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 3000); // live polling
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="container">
      <header>
        <h1>AssetGate</h1>
        <p className="subtitle">Phase 0 — Permissioned Token Cap Table</p>
        {health && (
          <div className="status">
            <span className="dot" /> API OK · token {short(health.token)} · indexed block #
            {health.lastIndexedBlock}
          </div>
        )}
      </header>

      {loading && <p className="muted">Loading cap table…</p>}

      {error && (
        <p className="error">
          Error: {error} — is the API running on port 4000?
        </p>
      )}

      {!loading && !error && data && (
        data.holderCount === 0 ? (
          <p className="muted">
            No holders yet. Deploy + mint, then watch this table update live.
          </p>
        ) : (
          <>
            <div className="summary">
              <div>
                <span className="label">Total Supply</span>
                <span className="value">{formatBig(data.totalSupply)}</span>
              </div>
              <div>
                <span className="label">Holders</span>
                <span className="value">{data.holderCount}</span>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Address</th>
                  <th>Balance</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {data.holders.map((h, i) => (
                  <tr key={h.address}>
                    <td>{i + 1}</td>
                    <td className="mono">{h.address}</td>
                    <td>{Number(h.balanceFormatted).toLocaleString()}</td>
                    <td>{h.percentage.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      )}
    </div>
  );
}