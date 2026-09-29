import "dotenv/config";

export const config = {
  rpcUrl: process.env.RPC_URL ?? "http://127.0.0.1:8545",
  tokenAddress: (process.env.TOKEN_ADDRESS ?? "").toLowerCase(),
  identityRegistry: (process.env.IDENTITY_REGISTRY ?? "").toLowerCase(),
  apiPort: Number(process.env.API_PORT ?? 4000),
  startBlock: BigInt(process.env.START_BLOCK ?? "0"),
  confirmations: BigInt(process.env.CONFIRMATIONS ?? "0"),
  pollingIntervalMs: Number(process.env.POLLING_INTERVAL_MS ?? 2000),
};

if (!config.tokenAddress) {
  console.warn("[config] TOKEN_ADDRESS is empty — set it after deploying the token.");
}