import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

// Set test environment so main() does not start the background polling loop
process.env.NODE_ENV = "test";

import {
  fetchAndHandle,
  syncBatch,
  getLastBlock,
  setLastBlock,
} from "../src/indexer";
import { prisma } from "../src/db";

describe("Indexer Checkpoint Resilience & Retry Tests", () => {
  const TEST_START_BLOCK = 1000n;
  let originalLastBlock: bigint | null = null;

  beforeEach(async () => {
    // Preserve existing database checkpoint state before each test
    originalLastBlock = await getLastBlock();
    await setLastBlock(TEST_START_BLOCK);
  });

  after(async () => {
    // Restore original checkpoint state after tests complete
    if (originalLastBlock !== null) {
      await setLastBlock(originalLastBlock);
    }
  });

  it("leaves checkpoint unchanged when eth_getLogs fails (RPC error / method disabled)", async () => {
    const mockFailingRpcClient = {
      getLogs: async () => {
        throw new Error("RPC Error: eth_getLogs method is disabled or timed out");
      },
    };

    const targetAddress = "0x7FeDd3a0CE285cEa908D037e2b03d631d7e53268" as `0x${string}`;
    const dummyEvent = { name: "Transfer" };

    // 1. Attempt to fetch logs with the failing RPC client
    await assert.rejects(
      async () => {
        await fetchAndHandle(
          targetAddress,
          dummyEvent,
          TEST_START_BLOCK + 1n,
          TEST_START_BLOCK + 50n,
          async () => {},
          mockFailingRpcClient
        );
      },
      /RPC Error: eth_getLogs method is disabled or timed out/,
      "fetchAndHandle must re-throw RPC getLogs errors"
    );

    // 2. Checkpoint MUST remain unchanged at TEST_START_BLOCK
    const currentLastBlock = await getLastBlock();
    assert.equal(
      currentLastBlock,
      TEST_START_BLOCK,
      "Checkpoint must NOT advance when getLogs fails"
    );

    // 3. Next cycle computes the exact same starting block for retry
    const nextFromBlock = currentLastBlock + 1n;
    assert.equal(
      nextFromBlock,
      TEST_START_BLOCK + 1n,
      "Next retry must begin at TEST_START_BLOCK + 1 to retry the failed batch"
    );
  });

  it("leaves checkpoint unchanged when event handler or database transaction fails", async () => {
    const mockLogs = [
      {
        blockNumber: 1005n,
        transactionHash: "0xabc123",
        logIndex: 0n,
        args: { from: "0x0000000000000000000000000000000000000000", to: "0x1111111111111111111111111111111111111111", value: 100n },
      },
    ];

    const mockRpcClient = {
      getLogs: async () => mockLogs,
    };

    const targetAddress = "0x7FeDd3a0CE285cEa908D037e2b03d631d7e53268" as `0x${string}`;
    const dummyEvent = { name: "Transfer" };

    // Handler simulates a database connection loss or deadlock
    const failingDatabaseHandler = async () => {
      throw new Error("DatabaseError: transaction deadlock / connection lost");
    };

    // 1. Execute batch with failing database handler
    await assert.rejects(
      async () => {
        await fetchAndHandle(
          targetAddress,
          dummyEvent,
          TEST_START_BLOCK + 1n,
          TEST_START_BLOCK + 50n,
          failingDatabaseHandler,
          mockRpcClient
        );
      },
      /DatabaseError: transaction deadlock \/ connection lost/,
      "fetchAndHandle must re-throw handler/database errors"
    );

    // 2. Checkpoint MUST remain unchanged
    const currentLastBlock = await getLastBlock();
    assert.equal(
      currentLastBlock,
      TEST_START_BLOCK,
      "Checkpoint must NOT advance when database transaction fails"
    );
  });

  it("successfully advances checkpoint only after batch processing completes, enabling clean retries", async () => {
    const safeHead = TEST_START_BLOCK + 25n;
    let batchProcessed = false;

    // Simulate batch execution succeeding on retry
    const successfulProcessRange = async (from: bigint, to: bigint) => {
      assert.equal(from, TEST_START_BLOCK + 1n);
      assert.equal(to, safeHead);
      batchProcessed = true;
    };

    await syncBatch(TEST_START_BLOCK + 1n, safeHead, successfulProcessRange);

    assert.equal(batchProcessed, true, "Batch was processed successfully");

    // Checkpoint now safely advanced to safeHead
    const currentLastBlock = await getLastBlock();
    assert.equal(
      currentLastBlock,
      safeHead,
      "Checkpoint must advance to safeHead after successful batch execution"
    );

    // Next run will cleanly start from safeHead + 1
    const nextFromBlock = currentLastBlock + 1n;
    assert.equal(
      nextFromBlock,
      safeHead + 1n,
      "Subsequent cycle must resume from safeHead + 1"
    );
  });
});
