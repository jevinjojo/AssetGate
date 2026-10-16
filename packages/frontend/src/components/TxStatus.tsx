export function TxStatus(props: {
  isPending: boolean; isConfirming: boolean; isSuccess: boolean; error: Error | null; hash?: `0x${string}`;
}) {
  const { isPending, isConfirming, isSuccess, error, hash } = props;
  if (error) return <p className="error">{error.message.split("\n")[0]}</p>;
  if (isPending) return <p className="muted">Confirm in wallet…</p>;
  if (isConfirming) {
    return (
      <p className="muted">
        Mining {hash ? (
          <a href={`https://scan.botchain.ai/tx/${hash}`} target="_blank" rel="noreferrer" className="mono small">
            {hash.slice(0, 10)}… ↗
          </a>
        ) : "…"}
      </p>
    );
  }
  if (isSuccess) {
    return (
      <p className="ok">
        ✓ Confirmed{" "}
        {hash && (
          <a
            href={`https://scan.botchain.ai/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
            className="mono small"
            style={{ marginLeft: "8px", textDecoration: "underline", color: "inherit" }}
          >
            Receipt: {hash.slice(0, 8)}…{hash.slice(-6)} ↗
          </a>
        )}
      </p>
    );
  }
  return null;
}