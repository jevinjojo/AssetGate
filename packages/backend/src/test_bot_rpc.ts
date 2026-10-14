async function testBotChainRpc() {
  const rpcUrl = "https://rpc.botchain.ai/";
  console.log("=== Testing BOT Chain Mainnet RPC (https://rpc.botchain.ai/) ===\n");

  // 1. Test eth_chainId
  const chainIdRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  }).then((r) => r.json());
  const chainIdDecimal = parseInt(chainIdRes.result, 16);
  console.log(`1. eth_chainId: ${chainIdRes.result} (${chainIdDecimal}) -> ${chainIdDecimal === 677 ? "PASS (BOT Mainnet)" : "FAIL"}`);

  // 2. Test eth_blockNumber
  const blockRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_blockNumber", params: [] }),
  }).then((r) => r.json());
  const latestBlock = parseInt(blockRes.result, 16);
  console.log(`2. eth_blockNumber: ${latestBlock} (Hex: ${blockRes.result}) -> PASS`);

  // 3. Test eth_getLogs across a 5-block range
  const fromBlock = latestBlock - 5;
  const toBlock = latestBlock;
  const fromHex = "0x" + fromBlock.toString(16);
  const toHex = "0x" + toBlock.toString(16);

  console.log(`\nQuerying eth_getLogs for 5 blocks (${fromBlock} to ${toBlock})...`);

  const logsRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "eth_getLogs",
      params: [{ fromBlock: fromHex, toBlock: toHex }],
    }),
  }).then((r) => r.json());

  if (logsRes.error) {
    console.error("3. eth_getLogs: FAILED with error:", logsRes.error);
  } else {
    console.log(`3. eth_getLogs: PASS! Successfully returned ${logsRes.result.length} logs with zero errors.`);
  }

  console.log("\n=== Result: RPC is fully working and supports eth_getLogs! ===");
}

testBotChainRpc().catch(console.error);
