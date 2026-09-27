import "dotenv/config";

export const config = {
  rpcUrl: process.env.RPC_URL ?? "http://127.0.0.1:8545",
  tokenAddress: (process.env.TOKEN_ADDRESS ?? "").toLowerCase(),
  dbFile: process.env.DB_FILE ?? "./assetgate.db",
  apiPort: Number(process.env.API_PORT ?? 4000),
  startBlock: BigInt(process.env.START_BLOCK ?? "0"),
};

if (!config.tokenAddress) {
  console.warn("[config] TOKEN_ADDRESS is empty — set it after deploying the token.");
}