// Test file to verify @opencode-ai/sdk types are available
import { createOpencodeClient, OpencodeClient } from "@opencode-ai/sdk";

// Type check - these should resolve without errors
type ClientType = OpencodeClient;
const createClient = createOpencodeClient;

export { createClient, type ClientType };
