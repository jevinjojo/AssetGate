import Database from "better-sqlite3";
import { config } from "./config";

export const ZERO = "0x0000000000000000000000000000000000000000";

export const db = new Database(config.dbFile);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS holders (
    address TEXT PRIMARY KEY,
    balance TEXT NOT NULL DEFAULT '0'
  );

  CREATE TABLE IF NOT EXISTS transfers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    block_number INTEGER NOT NULL,
    tx_hash      TEXT NOT NULL,
    log_index    INTEGER NOT NULL,
    from_address TEXT NOT NULL,
    to_address   TEXT NOT NULL,
    value        TEXT NOT NULL,
    UNIQUE (tx_hash, log_index)
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export function getBalance(address: string): bigint {
  const row = db.prepare("SELECT balance FROM holders WHERE address = ?").get(address) as
    | { balance: string }
    | undefined;
  return row ? BigInt(row.balance) : 0n;
}

export function setBalance(address: string, balance: bigint) {
  db.prepare(
    `INSERT INTO holders (address, balance) VALUES (?, ?)
     ON CONFLICT(address) DO UPDATE SET balance = excluded.balance`
  ).run(address, balance.toString());
}

export function getMeta(key: string): string | undefined {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function setMeta(key: string, value: string) {
  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
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
 * Idempotent + transactional. Inserts the transfer row; only if it was NEW
 * (not a duplicate) does it apply the balance deltas. This makes re-processing
 * the same log safe — a core property the plan calls out for the indexer.
 */
export const applyTransferTx = db.transaction((t: TransferInput): boolean => {
  const res = db
    .prepare(
      `INSERT OR IGNORE INTO transfers
        (block_number, tx_hash, log_index, from_address, to_address, value)
       VALUES (@blockNumber, @txHash, @logIndex, @from, @to, @value)`
    )
    .run({
      blockNumber: t.blockNumber,
      txHash: t.txHash,
      logIndex: t.logIndex,
      from: t.from,
      to: t.to,
      value: t.value.toString(),
    });

  if (res.changes === 0) return false; // already processed this log

  if (t.from !== ZERO) setBalance(t.from, getBalance(t.from) - t.value);
  if (t.to !== ZERO) setBalance(t.to, getBalance(t.to) + t.value);
  return true;
});