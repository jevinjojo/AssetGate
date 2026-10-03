import { parseAbiItem } from "viem";

// --- events we index ---
export const transferEvent =
  parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
export const addressFrozenEvent =
  parseAbiItem("event AddressFrozen(address indexed userAddress, bool indexed isFrozen, address indexed owner)");
export const tokensFrozenEvent =
  parseAbiItem("event TokensFrozen(address indexed userAddress, uint256 amount)");
export const tokensUnfrozenEvent =
  parseAbiItem("event TokensUnfrozen(address indexed userAddress, uint256 amount)");
export const pausedEvent = parseAbiItem("event Paused(address account)");
export const unpausedEvent = parseAbiItem("event Unpaused(address account)");
export const identityRegisteredEvent =
  parseAbiItem("event IdentityRegistered(address indexed investorAddress, address indexed identity)");
export const identityRemovedEvent =
  parseAbiItem("event IdentityRemoved(address indexed investorAddress, address indexed identity)");
export const countryUpdatedEvent =
  parseAbiItem("event CountryUpdated(address indexed investorAddress, uint16 indexed country)");

// --- read ABIs (for token metadata + live status) ---
export const tokenReadAbi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "isFrozen", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "getFrozenTokens", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },

] as const;

export const registryReadAbi = [
  { type: "function", name: "isVerified", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "investorCountry", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint16" }] },
  { type: "function", name: "identity", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "address" }] },
  { type: "function", name: "contains", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },

] as const;

export const registryWriteAbi = [
  { type: "function", name: "registerIdentity", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "address" }, { type: "uint16" }], outputs: [] },
] as const;

export const claimAbi = [
  { type: "function", name: "addClaim", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "address" }, { type: "bytes" }, { type: "bytes" }, { type: "string" }], outputs: [{ type: "bytes32" }] },
] as const;

export const complianceReadAbi = [
  { type: "function", name: "canTransfer", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export const moduleAbi = [
  { type: "function", name: "moduleCheck", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }, { type: "uint256" }, { type: "address" }], outputs: [{ type: "bool" }] },
] as const;