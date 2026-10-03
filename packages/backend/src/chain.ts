import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config";

const chain = defineChain({
  id: config.chainId,
  name: "assetgate-net",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
});

export const client = createPublicClient({ chain, transport: http(config.rpcUrl) });

export const account = config.issuerPrivateKey
  ? privateKeyToAccount(config.issuerPrivateKey as `0x${string}`)
  : undefined;

export const walletClient = account
  ? createWalletClient({ account, chain, transport: http(config.rpcUrl) })
  : undefined;