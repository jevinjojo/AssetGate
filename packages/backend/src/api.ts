import fastifyRateLimit from '@fastify/rate-limit'
import Fastify from "fastify";
import cors from "@fastify/cors";
import { formatUnits } from "viem";
import { config } from "./config";
import { prisma } from "./db";
import { client } from "./chain";
import { tokenReadAbi, registryReadAbi } from "./abi";

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256, encodeAbiParameters, parseAbiParameters } from "viem";
import { walletClient, account } from "./chain";
import { registryWriteAbi, claimAbi, complianceReadAbi, moduleAbi } from "./abi";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TOPIC_KYC = 1n;
const SCHEME_ECDSA = 1n;

let _identityArtifact: { abi: any; bytecode: { object: `0x${string}` } } | null = null;
function identityArtifact() {
  if (_identityArtifact) return _identityArtifact;
  const candidates = [
    resolve(__dirname, "./IdentityArtifact.json"),
    resolve(process.cwd(), "src/IdentityArtifact.json"),
    resolve(process.cwd(), "IdentityArtifact.json"),
    resolve(process.cwd(), "packages/backend/src/IdentityArtifact.json"),
    resolve(process.cwd(), "../contracts/out/Identity.sol/Identity.json"),
  ];
  const p = candidates.find((c) => existsSync(c));
  if (!p) {
    throw new Error(`Identity artifact not found in paths: ${candidates.join(", ")}`);
  }
  _identityArtifact = JSON.parse(readFileSync(p, "utf8"));
  return _identityArtifact!;
}

const read = (address: `0x${string}`, abi: any, functionName: string, args: any[]) =>
  client.readContract({ address, abi, functionName, args });

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
  await app.register(fastifyRateLimit, {
    max: 1000, // global limit for normal endpoints
    timeWindow: '1 minute'
  })

  await app.register(cors, { origin: true });

  app.get("/", async () => {
    const meta = await prisma.meta.findUnique({ where: { key: "lastBlock" } });
    let chainId = 0;
    try { chainId = await client.getChainId(); } catch { /* rpc down */ }
    return {
      service: "AssetGate Compliance & Indexer API",
      network: "BOT Chain Mainnet (Chain ID 677)",
      status: "healthy",
      token: TOKEN,
      lastIndexedBlock: Number(meta?.value ?? "0"),
      endpoints: {
        health: "/api/v1/health",
        capTable: "/api/v1/captable",
        holders: "/api/v1/holders",
        preflight: "/api/v1/transfer-preflight",
        merkleProof: "/api/v1/dividends/merkle-proof",
      },
    };
  });

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
    let country: number | null = investor?.country ?? null;
    try { verified = Boolean(await client.readContract({ address: config.identityRegistry as `0x${string}`, abi: registryReadAbi, functionName: "isVerified", args: [a] })); } catch { }
    try { frozen = Boolean(await client.readContract({ address: TOKEN as `0x${string}`, abi: tokenReadAbi, functionName: "isFrozen", args: [a] })); } catch { }
    try { frozenTokens = String(await client.readContract({ address: TOKEN as `0x${string}`, abi: tokenReadAbi, functionName: "getFrozenTokens", args: [a] })); } catch { }
    try { country = Number(await client.readContract({ address: config.identityRegistry as `0x${string}`, abi: registryReadAbi, functionName: "investorCountry", args: [a] })); } catch { }
    return {
      address: addr,
      verified,               // live from IdentityRegistry.isVerified
      frozen,                 // live from Token.isFrozen
      frozenTokens,           // live partial-freeze amount
      balance: holding?.balance ?? "0",
      country: country,
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

  // 10.1 — simulated KYC: deploy ONCHAINID -> sign+add claim -> register
  app.post("/api/v1/kyc", {
    config: {
      rateLimit: {
        max: 5, // restrict KYC strictly
        timeWindow: '1 hour'
      }
    }
  }, async (req, reply) => {
    if (!walletClient || !account) { reply.code(500); return { error: "backend signer not configured (set ISSUER_PRIVATE_KEY)" }; }
    const body = (req.body ?? {}) as { wallet?: string; country?: number };
    const wallet = (body.wallet ?? "").toLowerCase() as `0x${string}`;
    const country = Number(body.country ?? 840);
    if (!wallet) { reply.code(400); return { error: "wallet is required" }; }

    const IR = config.identityRegistry as `0x${string}`;

    // idempotent: already registered?
    const already = await read(IR, (await import("./abi")).registryReadAbi as any, "contains", [wallet]).catch(() => false);
    if (already) {
      const identity = await read(IR, (await import("./abi")).registryReadAbi as any, "identity", [wallet]);
      return { wallet, identity, verified: true, alreadyRegistered: true };
    }

    const art = identityArtifact();

    // 1) deploy the investor's ONCHAINID (managed by the backend issuer in V1)
    const deployHash = await walletClient.deployContract({ abi: art.abi, bytecode: art.bytecode.object, args: [account.address, false] });
    const deployRc = await client.waitForTransactionReceipt({ hash: deployHash });
    const identity = deployRc.contractAddress as `0x${string}`;

    // 2) sign + add the KYC claim
    const data = encodeAbiParameters(parseAbiParameters("string"), ["PASSED_KYC"]);
    const message = keccak256(encodeAbiParameters(parseAbiParameters("address, uint256, bytes"), [identity, TOPIC_KYC, data]));
    const signature = await walletClient.signMessage({ account, message: { raw: message } });
    const addClaimHash = await walletClient.writeContract({
      address: identity, abi: claimAbi, functionName: "addClaim",
      args: [TOPIC_KYC, SCHEME_ECDSA, config.claimIssuer as `0x${string}`, signature, data, ""],
    });
    await client.waitForTransactionReceipt({ hash: addClaimHash });

    // 3) register in the Identity Registry
    const regHash = await walletClient.writeContract({
      address: IR, abi: registryWriteAbi, functionName: "registerIdentity",
      args: [wallet, identity, country],
    });
    await client.waitForTransactionReceipt({ hash: regHash });

    app.log.info({ wallet, identity }, "KYC complete");
    return { wallet, identity, country, verified: true, txHashes: { deploy: deployHash, addClaim: addClaimHash, register: regHash } };
  });

  // 10.4 — human-readable preflight: WHY would this transfer fail?
  app.get("/api/v1/transfer-preflight", async (req) => {
    const q = req.query as any;
    const from = String(q.from ?? "").toLowerCase() as `0x${string}`;
    const to = String(q.to ?? "").toLowerCase() as `0x${string}`;
    const amount = BigInt(q.amount ?? "0");
    const T = config.tokenAddress as `0x${string}`;
    const IR = config.identityRegistry as `0x${string}`;
    const tokenReadAbi = (await import("./abi")).tokenReadAbi as any;
    const registryReadAbi = (await import("./abi")).registryReadAbi as any;

    const token = await prisma.token.findUnique({ where: { address: config.tokenAddress } });
    if (token?.paused) return { allowed: false, reason: "The token is currently paused; transfers are disabled." };

    const [frozenFrom, frozenTo, bal, frozenTokens, verifiedTo] = await Promise.all([
      read(T, tokenReadAbi, "isFrozen", [from]),
      read(T, tokenReadAbi, "isFrozen", [to]),
      read(T, tokenReadAbi, "balanceOf", [from]),
      read(T, tokenReadAbi, "getFrozenTokens", [from]),
      read(IR, registryReadAbi, "isVerified", [to]),
    ]);

    if (frozenFrom) return { allowed: false, reason: "Your wallet is frozen." };
    if (frozenTo) return { allowed: false, reason: "The recipient's wallet is frozen." };
    if (amount > BigInt(bal as bigint) - BigInt(frozenTokens as bigint))
      return { allowed: false, reason: "Amount exceeds your available (unfrozen) balance." };
    if (!verifiedTo) return { allowed: false, reason: "The recipient is not a verified investor." };

    const compliance = config.compliance as `0x${string}`;
    const can = await read(compliance, complianceReadAbi, "canTransfer", [from, to, amount]).catch(() => true);
    if (!can) {
      const checks: [string, string][] = [
        [config.countryModule, "The recipient's country is restricted."],
        [config.balanceModule, "This transfer would exceed the recipient's maximum balance."],
        [config.holderModule, "This transfer would exceed the maximum number of holders."],
      ];
      for (const [addr, reason] of checks) {
        if (!addr) continue;
        const ok = await read(addr as `0x${string}`, moduleAbi, "moduleCheck", [from, to, amount, compliance]).catch(() => true);
        if (!ok) return { allowed: false, reason };
      }
      return { allowed: false, reason: "Transfer blocked by compliance rules." };
    }

    return { allowed: true, reason: "" };
  });

  // 11.1 — snapshot the cap table and build the dividend Merkle tree
  app.post("/api/v1/dividends/prepare", async (req, reply) => {
    const { totalAmount } = (req.body ?? {}) as { totalAmount?: string };
    if (!totalAmount) { reply.code(400); return { error: "totalAmount (wei) required" }; }
    const total = BigInt(totalAmount);

    const token = await prisma.token.findUnique({ where: { address: config.tokenAddress } });
    const supply = BigInt(token?.totalSupply ?? "0");
    if (supply === 0n) { reply.code(400); return { error: "no supply to distribute to" }; }

    const holdings = await prisma.holding.findMany({ where: { tokenAddress: config.tokenAddress, balance: { not: "0" } } });
    const values = holdings
      .map((h) => [h.holderAddress, ((BigInt(h.balance) * total) / supply).toString()] as [string, string])
      .filter((v) => BigInt(v[1]) > 0n);
    if (values.length === 0) { reply.code(400); return { error: "no eligible holders" }; }

    const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
    const allocated = values.reduce((s, v) => s + BigInt(v[1]), 0n); // sum of floors (dust excluded)
    await prisma.dividend.upsert({
      where: { root: tree.root },
      create: { root: tree.root, total: allocated.toString(), tree: JSON.stringify(tree.dump()) },
      update: {},
    });
    return { root: tree.root, total: allocated.toString(), recipients: values.length };
  });

  // 11.2 — serve a holder's proof for a given distribution root
  app.get("/api/v1/dividends/proof", async (req, reply) => {
    const q = req.query as any;
    const root = String(q.root ?? "");
    const address = String(q.address ?? "").toLowerCase();
    const row = await prisma.dividend.findUnique({ where: { root } });
    if (!row) { reply.code(404); return { error: "distribution not found" }; }
    const tree = StandardMerkleTree.load(JSON.parse(row.tree));
    for (const [i, v] of tree.entries()) {
      if (String(v[0]).toLowerCase() === address) return { amount: String(v[1]), proof: tree.getProof(i) };
    }
    reply.code(404); return { error: "address not in distribution" };
  });

  await app.listen({ port: config.apiPort, host: "0.0.0.0" });
  app.log.info(`API on http://localhost:${config.apiPort}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});