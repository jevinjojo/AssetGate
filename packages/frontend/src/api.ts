import { config } from "./config";

export interface Holder {
  address: string; balance: string; balanceFormatted: string;
  frozen: boolean; frozenTokens: string; percentage: number;
}
export interface CapTable {
  token: string; name: string | null; symbol: string | null; decimals: number;
  paused: boolean; totalSupply: string; totalSupplyFormatted: string;
  holderCount: number; holders: Holder[];
}
export interface Status {
  address: string; verified: boolean; frozen: boolean; frozenTokens: string;
  balance: string; country: number | null; identity: string | null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${config.apiUrl}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const getCapTable = () => get<CapTable>("/api/v1/captable");
export const getStatus = (addr: string) => get<Status>(`/api/v1/investors/${addr}/status`);
export const getHealth = () => get<{ status: string; chainId: number; lastIndexedBlock: number }>("/api/v1/health");

export interface Preflight { allowed: boolean; reason: string; }

export async function postKyc(wallet: string, country: number) {
  const res = await fetch(`${config.apiUrl}/api/v1/kyc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet, country }),
  });
  if (!res.ok) throw new Error(`KYC ${res.status}`);
  return res.json();
}

export async function preflight(from: string, to: string, amount: string): Promise<Preflight> {
  const res = await fetch(`${config.apiUrl}/api/v1/transfer-preflight?from=${from}&to=${to}&amount=${amount}`);
  if (!res.ok) throw new Error(`preflight ${res.status}`);
  return res.json();
}

export async function prepareDividend(totalAmount: string) {
  const res = await fetch(`${config.apiUrl}/api/v1/dividends/prepare`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ totalAmount }),
  });
  if (!res.ok) throw new Error(`prepare ${res.status}`);
  return res.json() as Promise<{ root: string; total: string; recipients: number }>;
}
export async function dividendProof(root: string, address: string) {
  const res = await fetch(`${config.apiUrl}/api/v1/dividends/proof?root=${root}&address=${address}`);
  if (!res.ok) throw new Error("no allocation");
  return res.json() as Promise<{ amount: string; proof: string[] }>;
}