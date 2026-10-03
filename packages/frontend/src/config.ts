export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  chainId: Number(import.meta.env.VITE_CHAIN_ID ?? 31337),
  token: (import.meta.env.VITE_TOKEN_ADDRESS ?? "") as `0x${string}`,
  identityRegistry: (import.meta.env.VITE_IDENTITY_REGISTRY ?? "") as `0x${string}`,
  sepoliaRpc: import.meta.env.VITE_SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org",
};  