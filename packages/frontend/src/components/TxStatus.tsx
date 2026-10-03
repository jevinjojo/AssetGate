export function TxStatus(props: {
  isPending: boolean; isConfirming: boolean; isSuccess: boolean; error: Error | null; hash?: `0x${string}`;
}) {
  const { isPending, isConfirming, isSuccess, error, hash } = props;
  if (error) return <p className="error">{error.message.split("\n")[0]}</p>;
  if (isPending) return <p className="muted">Confirm in wallet…</p>;
  if (isConfirming) return <p className="muted">Mining {hash?.slice(0, 10)}…</p>;
  if (isSuccess) return <p className="ok">✓ Confirmed</p>;
  return null;
}