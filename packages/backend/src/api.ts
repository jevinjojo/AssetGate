import Fastify from "fastify";
import cors from "@fastify/cors";
import { formatUnits } from "viem";
import { config } from "./config";
import { db } from "./db";

async function main() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/api/v1/health", async () => {
    const lastBlock =
      (db.prepare("SELECT value FROM meta WHERE key = 'lastBlock'").get() as
        | { value: string }
        | undefined)?.value ?? "0";
    return {
      status: "ok",
      token: config.tokenAddress,
      lastIndexedBlock: Number(lastBlock),
    };
  });

  app.get("/api/v1/holders", async () => {
    const rows = db
      .prepare("SELECT address, balance FROM holders WHERE balance != '0'")
      .all() as { address: string; balance: string }[];

    const totalSupply = rows.reduce((sum, r) => sum + BigInt(r.balance), 0n);

    const holders = rows
      .map((r) => {
        const bal = BigInt(r.balance);
        return {
          address: r.address,
          balance: r.balance,
          balanceFormatted: formatUnits(bal, 18),
          percentage:
            totalSupply > 0n ? Number((bal * 10000n) / totalSupply) / 100 : 0,
        };
      })
      .sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));

    return {
      totalSupply: totalSupply.toString(),
      holderCount: holders.length,
      holders,
    };
  });

  app.get("/api/v1/transfers", async () => {
    const transfers = db
      .prepare(
        `SELECT block_number AS blockNumber, tx_hash AS txHash,
                from_address AS fromAddress, to_address AS toAddress, value
         FROM transfers ORDER BY id DESC LIMIT 25`
      )
      .all();
    return { transfers };
  });

  await app.listen({ port: config.apiPort, host: "0.0.0.0" });
  console.log(`[api] listening on http://localhost:${config.apiPort}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});