import { PrismaClient } from "@prisma/client";
import { config } from "./config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
export const prisma = new PrismaClient({ adapter });

export const ZERO = "0x0000000000000000000000000000000000000000";

export async function getBalance(address: string): Promise<bigint> {
  const row = await prisma.holding.findUnique({
    where: {
      tokenAddress_holderAddress: {
        tokenAddress: config.tokenAddress,
        holderAddress: address,
      },
    },
  });
  return row ? BigInt(row.balance) : 0n;
}

export async function setBalance(address: string, balance: bigint) {
  await prisma.holding.upsert({
    where: {
      tokenAddress_holderAddress: {
        tokenAddress: config.tokenAddress,
        holderAddress: address,
      },
    },
    create: {
      tokenAddress: config.tokenAddress,
      holderAddress: address,
      balance: balance.toString(),
    },
    update: { balance: balance.toString() },
  });
}

export async function getMeta(key: string): Promise<string | undefined> {
  const row = await prisma.meta.findUnique({ where: { key } });
  return row?.value;
}

export async function setMeta(key: string, value: string) {
  await prisma.meta.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export interface TransferInput {
  blockNumber: number;
  txHash: string;
  logIndex: number;
  from: string;
  to: string;
  value: bigint;
}

/**
 * Idempotent + transactional. Inserts the transfer event; only if it was NEW
 * (not a duplicate) does it apply the balance deltas.
 */
export async function applyTransferTx(t: TransferInput): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    try {
      await tx.event.create({
        data: {
          blockNumber: t.blockNumber,
          txHash: t.txHash,
          logIndex: t.logIndex,
          type: "Transfer",
          tokenAddress: config.tokenAddress,
          fromAddress: t.from,
          toAddress: t.to,
          value: t.value.toString(),
        },
      });
    } catch (err: any) {
      if (err.code === "P2002") return false; // unique constraint on (txHash, logIndex) — already processed
      throw err;
    }

    if (t.from !== ZERO) {
      const bal = await getBalance(t.from);
      await setBalance(t.from, bal - t.value);
    }
    if (t.to !== ZERO) {
      const bal = await getBalance(t.to);
      await setBalance(t.to, bal + t.value);
    }
    return true;
  });
}