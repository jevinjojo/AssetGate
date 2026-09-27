import { createPublicClient, http, parseAbiItem } from "viem";
import { config } from "./config";
import { applyTransferTx, getMeta, setMeta, ZERO } from "./db";

const client = createPublicClient({ transport: http(config.rpcUrl) });

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

function processLog(log: {
  args: { from?: string; to?: string; value?: bigint };
  blockNumber: bigint | null;
  transactionHash: string | null;
  logIndex: number | null;
}) {
  const from = (log.args.from ?? ZERO).toLowerCase();
  const to = (log.args.to ?? ZERO).toLowerCase();
  const value = log.args.value ?? 0n;

  const applied = applyTransferTx({
    blockNumber: Number(log.blockNumber ?? 0n),
    txHash: log.transactionHash ?? "",
    logIndex: log.logIndex ?? 0,
    from,
    to,
    value,
  });

  if (applied) {
    const kind = from === ZERO ? "MINT    " : "TRANSFER";
    console.log(`[indexer] ${kind} ${from} -> ${to} : ${value.toString()}`);
  }
}

async function backfill() {
  const last = BigInt(getMeta("lastBlock") ?? config.startBlock.toString());
  const latest = await client.getBlockNumber();
  const fromBlock = last === 0n ? config.startBlock : last + 1n;
  if (latest < fromBlock) return;

  const logs = await client.getLogs({
    address: config.tokenAddress as `0x${string}`,
    event: transferEvent,
    fromBlock,
    toBlock: latest,
  });

  for (const log of logs) processLog(log);
  setMeta("lastBlock", latest.toString());
  console.log(`[indexer] backfilled ${logs.length} transfer(s) up to block ${latest}.`);
}

async function main() {
  if (!config.tokenAddress) {
    console.error("[indexer] TOKEN_ADDRESS is not set. Deploy first, then set it in .env.");
    process.exit(1);
  }
  console.log("[indexer] starting for token", config.tokenAddress);

  await backfill(); // persist history BEFORE we start serving live

  client.watchEvent({
    address: config.tokenAddress as `0x${string}`,
    event: transferEvent,
    pollingInterval: 1000,
    onLogs: (logs) => {
      for (const log of logs) processLog(log);
      const maxBlock = logs.reduce((m, l) => (l.blockNumber! > m ? l.blockNumber! : m), 0n);
      if (maxBlock > 0n) setMeta("lastBlock", maxBlock.toString());
    },
  });

  console.log("[indexer] watching for new Transfer events…");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});