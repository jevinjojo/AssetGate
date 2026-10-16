import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import { config as appConfig } from "./config";

export const botchain = defineChain({
  id: 677,
  name: "BOT Chain Mainnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.botchain.ai"] } },
  blockExplorers: { default: { name: "BOT Chain Explorer", url: "https://scan.botchain.ai" } },
});

export const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

export const wagmiConfig = createConfig({
  chains: [botchain, anvil, sepolia],
  connectors: [injected()],
  transports: {
    [botchain.id]: http("https://rpc.botchain.ai"),
    [anvil.id]: http("http://127.0.0.1:8545"),
    [sepolia.id]: http(appConfig.sepoliaRpc),
  },
});