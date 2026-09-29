import Fastify from "fastify";
import cors from "@fastify/cors";
import { formatUnits } from "viem";
import { config } from "./config";
import { prisma } from "./db";
import { client } from "./chain";
import { tokenReadAbi, registryReadAbi } from "./abi";

const TOKEN = config.tokenAddress;

async function buildCapTable() {
  const token = await prisma.token.findUnique({ where: { address: TOKEN } });
  const decimals = token?.decimals ?? 18;
  const totalSupply = BigInt(token?.totalSupply ?? "0");
  const rows = await prisma.holding.findMany({ where: { tokenAddress: TOKEN, balance: { not: "0" } } });

  const holders = rows
    .map((h) => {
      const bal = BigInt(h.balance);
      return {
        address: h.holderAddress,
        balance: h.balance,
        balanceFormatted: formatUnits(bal, decimals),
        frozen: h.frozen,
        frozenTokens: h.frozenTokens,
        percentage: totalSupply > 0n ? Number((bal * 10000n) / totalSupply) / 100 : 0,
      };
    })
    .sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));

  return {
    token: TOKEN,
    name: token?.name ?? null,
    symbol: token?.symbol ?? null,
    decimals,
    paused: token?.paused ?? false,
    totalSupply: totalSupply.toString(),
    totalSupplyFormatted: formatUnits(totalSupply, decimals),
    holderCount: holders.length,
    holders,
  };
}

async function main() {
  const app = Fastify({ logger: true }); // structured logs via pino
  await app.register(cors, { origin: true });

  app.get("/api/v1/health", async () => {
    const meta = await prisma.meta.findUnique({ where: { key: "lastBlock" } });
    let chainId = 0;
    try { chainId = await client.getChainId(); } catch { /* rpc down */ }
    return { status: "ok", chainId, token: TOKEN, lastIndexedBlock: Number(meta?.value ?? "0") };
  });

  app.get("/api/v1/ready", async (_req, reply) => {
    try { await prisma.$queryRaw`SELECT 1`; return { ready: true }; }
    catch { reply.code(503); return { ready: false }; }
  });

  app.get("/api/v1/holders", async () => (await buildCapTable()).holders);

  app.get("/api/v1/captable", async () => buildCapTable());

  app.get("/api/v1/tokens/:address", async (req, reply) => {
    const address = (req.params as any).address.toLowerCase();
    const token = await prisma.token.findUnique({ where: { address } });
    if (!token) { reply.code(404); return { error: "token not found" }; }
    const holderCount = await prisma.holding.count({ where: { tokenAddress: address, balance: { not: "0" } } });
    return { ...token, holderCount };
  });

  app.get("/api/v1/investors/:addr/status", async (req) => {
    const addr = (req.params as any).addr.toLowerCase();
    const a = addr as `0x${string}`;
    const investor = await prisma.investor.findUnique({ where: { address: addr } });
    const holding = await prisma.holding.findUnique({
      where: { tokenAddress_holderAddress: { tokenAddress: TOKEN, holderAddress: addr } },
    });

    let verified = false, frozen = false, frozenTokens = "0";
    try { verified = Boolean(await client.readContract({ address: config.identityRegistry as `0x${string}`, abi: registryReadAbi, functionName: "isVerified", args: [a] })); } catch {}
    try { frozen = Boolean(await client.readContract({ address: TOKEN as `0x${string}`, abi: tokenReadAbi, functionName: "isFrozen", args: [a] })); } catch {}
    try { frozenTokens = String(await client.readContract({ address: TOKEN as `0x${string}`, abi: tokenReadAbi, functionName: "getFrozenTokens", args: [a] })); } catch {}

    return {
      address: addr,
      verified,               // live from IdentityRegistry.isVerified
      frozen,                 // live from Token.isFrozen
      frozenTokens,           // live partial-freeze amount
      balance: holding?.balance ?? "0",
      country: investor?.country ?? null,
      identity: investor?.identity ?? null,
    };
  });

  app.get("/api/v1/events", async (req) => {
    const q = req.query as any;
    const limit = Math.min(Number(q.limit ?? 50), 200);
    const where = q.type ? { type: String(q.type) } : {};
    const events = await prisma.event.findMany({ where, orderBy: { id: "desc" }, take: limit });
    return { events };
  });

  await app.listen({ port: config.apiPort, host: "0.0.0.0" });
    app.log.info(`API on http://localhost:${config.apiPort}`);
  }

main().catch((e) => {
  console.error(e);
  process.exit(1);
});