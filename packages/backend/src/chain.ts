import { createPublicClient, http } from "viem";
import { config } from "./config";

export const client = createPublicClient({ transport: http(config.rpcUrl) });