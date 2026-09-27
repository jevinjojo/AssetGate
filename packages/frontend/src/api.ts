const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export interface Holder {
  address: string;
  balance: string;
  balanceFormatted: string;
  percentage: number;
}
export interface HoldersResponse {
  totalSupply: string;
  holderCount: number;
  holders: Holder[];
}
export interface Health {
  status: string;
  token: string;
  lastIndexedBlock: number;
}

export async function fetchHolders(): Promise<HoldersResponse> {
  const res = await fetch(`${API_URL}/api/v1/holders`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function fetchHealth(): Promise<Health> {
  const res = await fetch(`${API_URL}/api/v1/health`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}