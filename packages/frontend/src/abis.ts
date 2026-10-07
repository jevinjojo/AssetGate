export const tokenAbi = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "_to", type: "address" }, { name: "_amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "burn", stateMutability: "nonpayable", inputs: [{ name: "_userAddress", type: "address" }, { name: "_amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "setAddressFrozen", stateMutability: "nonpayable", inputs: [{ name: "_userAddress", type: "address" }, { name: "_freeze", type: "bool" }], outputs: [] },
  { type: "function", name: "freezePartialTokens", stateMutability: "nonpayable", inputs: [{ name: "_userAddress", type: "address" }, { name: "_amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "forcedTransfer", stateMutability: "nonpayable", inputs: [{ name: "_from", type: "address" }, { name: "_to", type: "address" }, { name: "_amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "pause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "unpause", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

export const identityRegistryAbi = [
  { type: "function", name: "registerIdentity", stateMutability: "nonpayable", inputs: [{ name: "_userAddress", type: "address" }, { name: "_identity", type: "address" }, { name: "_country", type: "uint16" }], outputs: [] },
  { type: "function", name: "deleteIdentity", stateMutability: "nonpayable", inputs: [{ name: "_userAddress", type: "address" }], outputs: [] },
  { type: "function", name: "updateCountry", stateMutability: "nonpayable", inputs: [{ name: "_userAddress", type: "address" }, { name: "_country", type: "uint16" }], outputs: [] },
] as const;

export const tokenTransferAbi = [
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export const mockUsdcAbi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export const distributorAbi = [
  { type: "function", name: "createDistribution", stateMutability: "nonpayable", inputs: [{ type: "bytes32" }, { type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "bytes32[]" }], outputs: [] },
  { type: "function", name: "distributions", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "bytes32" }, { type: "uint256" }, { type: "uint256" }] },
] as const;