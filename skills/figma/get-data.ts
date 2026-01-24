#!/usr/bin/env npx tsx

/**
 * CLI tool to fetch Figma design data
 * 
 * Usage:
 *   ./get-data.ts <fileKey> [--node-id <nodeId>] [--depth <number>]
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

// Import from figma-developer-mcp
import { simplifyRawFigmaObject, allExtractors } from "figma-developer-mcp";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Types from figma-developer-mcp (not exported, so we define locally)
interface FigmaAuthOptions {
  figmaApiKey: string;
  figmaOAuthToken: string;
  useOAuth: boolean;
}

// Simple FigmaService wrapper (the class isn't exported directly from index)
class FigmaClient {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.figma.com/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: { "X-Figma-Token": this.apiKey },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Figma API error (${response.status}): ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async getFile(fileKey: string, depth?: number) {
    const endpoint = `/files/${fileKey}${depth ? `?depth=${depth}` : ""}`;
    return this.request<any>(endpoint);
  }

  async getNode(fileKey: string, nodeId: string, depth?: number) {
    const endpoint = `/files/${fileKey}/nodes?ids=${nodeId}${depth ? `&depth=${depth}` : ""}`;
    return this.request<any>(endpoint);
  }
}

function loadConfig(): { apiKey: string } {
  const configPath = join(__dirname, "config.json");
  try {
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);
    if (!config.apiKey) {
      console.error("Error: API key not configured in config.json");
      console.error(`Please add your Figma API key to: ${configPath}`);
      process.exit(1);
    }
    return config;
  } catch (err) {
    console.error(`Error reading config: ${configPath}`);
    console.error("Create config.json with: { \"apiKey\": \"your-figma-api-key\" }");
    process.exit(1);
  }
}

function parseArgs(args: string[]) {
  const result: { fileKey?: string; nodeId?: string; depth?: number } = {};
  
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (arg === "--node-id" && i + 1 < args.length) {
      result.nodeId = args[++i];
    } else if (arg === "--depth" && i + 1 < args.length) {
      result.depth = parseInt(args[++i], 10);
    } else if (!arg.startsWith("--") && !result.fileKey) {
      result.fileKey = arg;
    }
    i++;
  }
  
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  if (!args.fileKey) {
    console.error("Usage: get-data.ts <fileKey> [--node-id <nodeId>] [--depth <number>]");
    console.error("");
    console.error("Arguments:");
    console.error("  fileKey     The Figma file key (from URL: figma.com/design/<fileKey>/...)");
    console.error("  --node-id   Optional. Specific node ID to fetch (format: 1234:5678 or 1234-5678)");
    console.error("  --depth     Optional. Limit traversal depth");
    process.exit(1);
  }

  const config = loadConfig();
  const client = new FigmaClient(config.apiKey);

  // Normalize nodeId: replace - with : (Figma API expects :)
  const nodeId = args.nodeId?.replace(/-/g, ":");

  try {
    console.error(`Fetching ${nodeId ? `node ${nodeId} from` : ""} file ${args.fileKey}...`);
    
    // Fetch raw data from Figma API
    const rawData = nodeId
      ? await client.getNode(args.fileKey, nodeId, args.depth)
      : await client.getFile(args.fileKey, args.depth);

    // Use the MCP's extractors to simplify the data
    const simplifiedDesign = simplifyRawFigmaObject(rawData, allExtractors, {
      maxDepth: args.depth,
    });

    const { nodes, globalVars, ...metadata } = simplifiedDesign;
    const result = {
      metadata,
      nodes,
      globalVars,
    };

    // Output as YAML
    console.log(yaml.dump(result, { lineWidth: -1, noRefs: true }));
    
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
