import { config } from "./config";
import { prisma, ZERO } from "./db";
import { client } from "./chain";
import * as ev from "./abi";
import { tokenReadAbi } from "./abi";

const TOKEN = config.tokenAddress as `0x${string}`;
const REGISTRY = config.identityRegistry as `0x${string}`;

function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), level, svc: "indexer", msg, ...extra }));
}

type Meta = {
  blockNumber: number; txHash: string; logIndex: number; type: string;
  fromAddress: string | null; toAddress: string | null; value: string | null;
};

function metaOf(l: any, type: string, from: string | null, to: string | null, value: string | null): Meta {
  return {
    blockNumber: Number(l.blockNumber), txHash: l.transactionHash, logIndex: Number(l.logIndex),
    type, fromAddress: from, toAddress: to, value,
  };
}

/** Idempotency: insert the event row; return false if it already existed. */
async function createEventIfNew(tx: any, m: Meta): Promise<boolean> {
  const existing = await tx.event.findUnique({ where: { txHash_logIndex: { txHash: m.txHash, logIndex: m.logIndex } } });
  if (existing) return false;
  await tx.event.create({ data: { ...m, tokenAddress: TOKEN.toLowerCase() } });
  return true;
}

async function adjustHolding(tx: any, holder: string, delta: bigint) {
  const where = { tokenAddress_holderAddress: { tokenAddress: TOKEN.toLowerCase(), holderAddress: holder } };
  const existing = await tx.holding.findUnique({ where });
  const next = (existing ? BigInt(existing.balance) : 0n) + delta;
  await tx.holding.upsert({
    where,
    create: { tokenAddress: TOKEN.toLowerCase(), holderAddress: holder, balance: next.toString() },
    update: { balance: next.toString() },
  });
}

async function adjustSupply(tx: any, delta: bigint) {
  const t = await tx.token.findUnique({ where: { address: TOKEN.toLowerCase() } });
  const next = (t ? BigInt(t.totalSupply) : 0n) + delta;
  await tx.token.update({ where: { address: TOKEN.toLowerCase() }, data: { totalSupply: next.toString() } });
}

// ---------- handlers ----------
async function handleTransfer(l: any) {
  const from = String(l.args.from).toLowerCase();
  const to = String(l.args.to).toLowerCase();
  const value = l.args.value as bigint;
  const type = from === ZERO ? "MINT" : to === ZERO ? "BURN" : "TRANSFER";
  await prisma.$transaction(async (tx) => {
    if (!(await createEventIfNew(tx, metaOf(l, type, from, to, value.toString())))) return;
    if (from !== ZERO) await adjustHolding(tx, from, -value);
    if (to !== ZERO) await adjustHolding(tx, to, value);
    if (from === ZERO) await adjustSupply(tx, value);   // mint
    if (to === ZERO) await adjustSupply(tx, -value);     // burn
  });
  log("info", type, { from, to, value: value.toString() });
}

async function handleAddressFrozen(l: any) {
  const user = String(l.args.userAddress).toLowerCase();
  const isFrozen = Boolean(l.args.isFrozen);
  await prisma.$transaction(async (tx) => {
    if (!(await createEventIfNew(tx, metaOf(l, "ADDRESS_FROZEN", null, user, isFrozen ? "1" : "0")))) return;
    const where = { tokenAddress_holderAddress: { tokenAddress: TOKEN.toLowerCase(), holderAddress: user } };
    await tx.holding.upsert({
      where,
      create: { tokenAddress: TOKEN.toLowerCase(), holderAddress: user, frozen: isFrozen },
      update: { frozen: isFrozen },
    });
  });
}

async function adjustFrozenTokens(l: any, delta: bigint, type: string) {
  const user = String(l.args.userAddress).toLowerCase();
  await prisma.$transaction(async (tx) => {
    if (!(await createEventIfNew(tx, metaOf(l, type, null, user, delta.toString())))) return;
    const where = { tokenAddress_holderAddress: { tokenAddress: TOKEN.toLowerCase(), holderAddress: user } };
    const existing = await tx.holding.findUnique({ where });
    const next = (existing ? BigInt(existing.frozenTokens) : 0n) + delta;
    await tx.holding.upsert({
      where,
      create: { tokenAddress: TOKEN.toLowerCase(), holderAddress: user, frozenTokens: next.toString() },
      update: { frozenTokens: next.toString() },
    });
  });
}
const handleTokensFrozen = (l: any) => adjustFrozenTokens(l, l.args.amount as bigint, "TOKENS_FROZEN");
const handleTokensUnfrozen = (l: any) => adjustFrozenTokens(l, -(l.args.amount as bigint), "TOKENS_UNFROZEN");

async function setPaused(l: any, paused: boolean, type: string) {
  await prisma.$transaction(async (tx) => {
    if (!(await createEventIfNew(tx, metaOf(l, type, null, null, null)))) return;
    await tx.token.update({ where: { address: TOKEN.toLowerCase() }, data: { paused } });
  });
}
const handlePaused = (l: any) => setPaused(l, true, "PAUSED");
const handleUnpaused = (l: any) => setPaused(l, false, "UNPAUSED");

async function handleIdentityRegistered(l: any) {
  const investor = String(l.args.investorAddress).toLowerCase();
  const identity = String(l.args.identity).toLowerCase();
  await prisma.$transaction(async (tx) => {
    if (!(await createEventIfNew(tx, metaOf(l, "IDENTITY_REGISTERED", null, investor, null)))) return;
    await tx.investor.upsert({ where: { address: investor }, create: { address: investor, identity, verified: true }, update: { identity, verified: true } });
  });
}
async function handleIdentityRemoved(l: any) {
  const investor = String(l.args.investorAddress).toLowerCase();
  await prisma.$transaction(async (tx) => {
    if (!(await createEventIfNew(tx, metaOf(l, "IDENTITY_REMOVED", null, investor, null)))) return;
    await tx.investor.upsert({ where: { address: investor }, create: { address: investor, verified: false }, update: { verified: false } });
  });
}
async function handleCountryUpdated(l: any) {
  const investor = String(l.args.investorAddress).toLowerCase();
  const country = Number(l.args.country);
  await prisma.$transaction(async (tx) => {
    if (!(await createEventIfNew(tx, metaOf(l, "COUNTRY_UPDATED", null, investor, String(country))))) return;
    await tx.investor.upsert({ where: { address: investor }, create: { address: investor, country, verified: true }, update: { country } });
  });
}

// ---------- range processing ----------
async function fetchAndHandle(address: `0x${string}`, event: any, from: bigint, to: bigint, handler: (l: any) => Promise<void>) {
  let logs: any[] = [];
  try {
    logs = await client.getLogs({ address, event, fromBlock: from, toBlock: to });
  } catch (e) {
    log("warn", "getLogs failed (event may not exist in this version)", { event: (event as any).name, error: String(e) });
    return;
  }
  for (const l of logs) {
    try { await handler(l); } catch (e) { log("error", "handler failed", { error: String(e) }); }
  }
}

async function processRange(from: bigint, to: bigint) {
  await fetchAndHandle(TOKEN, ev.transferEvent, from, to, handleTransfer);          // ordered => balances correct
  await fetchAndHandle(TOKEN, ev.addressFrozenEvent, from, to, handleAddressFrozen);
  await fetchAndHandle(TOKEN, ev.tokensFrozenEvent, from, to, handleTokensFrozen);
  await fetchAndHandle(TOKEN, ev.tokensUnfrozenEvent, from, to, handleTokensUnfrozen);
  await fetchAndHandle(TOKEN, ev.pausedEvent, from, to, handlePaused);
  await fetchAndHandle(TOKEN, ev.unpausedEvent, from, to, handleUnpaused);
  if (config.identityRegistry) {
    await fetchAndHandle(REGISTRY, ev.identityRegisteredEvent, from, to, handleIdentityRegistered);
    await fetchAndHandle(REGISTRY, ev.identityRemovedEvent, from, to, handleIdentityRemoved);
    await fetchAndHandle(REGISTRY, ev.countryUpdatedEvent, from, to, handleCountryUpdated);
  }
}

// ---------- resumable, confirmation-aware loop ----------
async function getLastBlock(): Promise<bigint | null> {
  const m = await prisma.meta.findUnique({ where: { key: "lastBlock" } });
  return m ? BigInt(m.value) : null;
}
async function setLastBlock(b: bigint) {
  await prisma.meta.upsert({ where: { key: "lastBlock" }, create: { key: "lastBlock", value: b.toString() }, update: { value: b.toString() } });
}

async function ensureToken() {
  const [name, symbol, decimals] = await Promise.all([
    client.readContract({ address: TOKEN, abi: tokenReadAbi, functionName: "name" }),
    client.readContract({ address: TOKEN, abi: tokenReadAbi, functionName: "symbol" }),
    client.readContract({ address: TOKEN, abi: tokenReadAbi, functionName: "decimals" }),
  ]);
  await prisma.token.upsert({
    where: { address: TOKEN.toLowerCase() },
    create: { address: TOKEN.toLowerCase(), name: String(name), symbol: String(symbol), decimals: Number(decimals) },
    update: { name: String(name), symbol: String(symbol), decimals: Number(decimals) },
  });
  log("info", "token ensured", { token: TOKEN.toLowerCase(), name, symbol });
}

async function syncOnce() {
  const latest = await client.getBlockNumber();
  const safeHead = latest > config.confirmations ? latest - config.confirmations : 0n; // 8.5 reorg-safety
  const last = await getLastBlock();
  const fromBlock = last === null ? config.startBlock : last + 1n;
  if (safeHead < fromBlock) return;
  await processRange(fromBlock, safeHead);
  await setLastBlock(safeHead);                                                          // 8.3 resumable
  log("info", "synced", { from: fromBlock.toString(), to: safeHead.toString() });
}

async function main() {
  if (!config.tokenAddress) { log("error", "TOKEN_ADDRESS not set"); process.exit(1); }
  log("info", "indexer starting", { rpc: config.rpcUrl, token: config.tokenAddress, confirmations: config.confirmations.toString() });
  await ensureToken();
  await syncOnce(); // persist history BEFORE serving
  setInterval(() => { syncOnce().catch((e) => log("error", "sync loop error", { error: String(e) })); }, config.pollingIntervalMs);
  log("info", "watching", { intervalMs: config.pollingIntervalMs });
}

main().catch((e) => { log("error", "fatal", { error: String(e) }); process.exit(1); });