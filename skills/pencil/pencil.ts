#!/usr/bin/env npx ts-node --esm

/**
 * Pencil MCP Client CLI
 * 
 * Connects to Pencil.app's MCP server and exposes all tools as CLI commands.
 * Assumes Pencil.app is already running.
 */

import { spawn, ChildProcess, execSync } from "node:child_process";
import * as fs from "node:fs";

const MCP_SERVER_PATH = "/Applications/Pencil.app/Contents/Resources/app.asar.unpacked/out/mcp-server-darwin-arm64";

/**
 * Auto-detect Pencil.app's WebSocket port by finding its listening port
 */
function detectPencilPort(): number {
  try {
    const output = execSync('lsof -i -P 2>/dev/null | grep "Pencil" | grep LISTEN', { encoding: 'utf-8' });
    const match = output.match(/:(\d+)\s+\(LISTEN\)/);
    if (match) {
      return parseInt(match[1], 10);
    }
  } catch {
    // lsof failed or no match
  }
  throw new Error("Could not detect Pencil.app port. Is Pencil.app running?");
}

const WS_PORT = detectPencilPort();

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

class MCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private buffer = "";
  private initialized = false;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(MCP_SERVER_PATH, ["--ws-port", WS_PORT.toString()], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.process.on("error", (err) => {
        reject(new Error(`Failed to start MCP server: ${err.message}`));
      });

      this.process.on("exit", (code) => {
        if (!this.initialized) {
          reject(new Error(`MCP server exited with code ${code}`));
        }
      });

      // Handle stdout - buffer and parse JSON lines
      this.process.stdout?.on("data", (data: Buffer) => {
        this.buffer += data.toString();
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() || ""; // Keep incomplete line in buffer
        for (const line of lines) {
          if (line.trim()) {
            this.handleLine(line);
          }
        }
      });

      // Suppress stderr
      this.process.stderr?.on("data", () => {});

      // Initialize and wait for WebSocket connection
      this.initialize().then(async () => {
        this.initialized = true;
        // Wait 1s for WebSocket to connect to Pencil.app
        await new Promise(r => setTimeout(r, 1000));
        resolve();
      }).catch(reject);
    });
  }

  private handleLine(line: string): void {
    try {
      const response: JsonRpcResponse = JSON.parse(line);
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        this.pendingRequests.delete(response.id);
        if (response.error) {
          pending.reject(new Error(`MCP Error: ${response.error.message}`));
        } else {
          pending.resolve(response.result);
        }
      }
    } catch {
      // Not JSON, ignore
    }
  }

  private async sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.process!.stdin!.write(JSON.stringify(request) + "\n");

      // Timeout after 60 seconds (some operations like image generation can be slow)
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 60000);
    });
  }

  private async initialize(): Promise<void> {
    await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "pencil-cli", version: "1.0.0" },
    });
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return this.sendRequest("tools/call", {
      name: toolName,
      arguments: args,
    });
  }

  close(): void {
    if (this.process) {
      this.process.stdin?.end();
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }
}

// ============================================================================
// CLI Commands
// ============================================================================

interface ToolResult {
  content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

function formatResult(result: unknown): string {
  const toolResult = result as ToolResult;
  
  if (toolResult.content && Array.isArray(toolResult.content)) {
    const parts: string[] = [];
    for (const item of toolResult.content) {
      if (item.type === "text" && item.text) {
        parts.push(item.text);
      } else if (item.type === "image" && item.data) {
        // For images, save to file and return path
        const filename = `/tmp/pencil-screenshot-${Date.now()}.png`;
        const buffer = Buffer.from(item.data, "base64");
        fs.writeFileSync(filename, buffer);
        parts.push(`[Screenshot saved to: ${filename}]`);
      }
    }
    return parts.join("\n");
  }
  
  return JSON.stringify(result, null, 2);
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        result[key] = value;
        i++;
      } else {
        result[key] = "true";
      }
    }
  }
  return result;
}

function parseJsonArg(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = parseArgs(args.slice(1));

  if (!command || command === "help" || command === "--help") {
    printHelp();
    process.exit(0);
  }

  const client = new MCPClient();

  try {
    await client.connect();

    let result: unknown;

    switch (command) {
      case "get_editor_state":
      case "state": {
        const includeSchema = options["include-schema"] === "true";
        result = await client.callTool("get_editor_state", { include_schema: includeSchema });
        break;
      }

      case "open_document":
      case "open": {
        const filePathOrTemplate = options["file"] || options["template"] || "new";
        result = await client.callTool("open_document", { filePathOrTemplate });
        break;
      }

      case "get_guidelines":
      case "guidelines": {
        const topic = options["topic"];
        if (!topic) {
          console.error("Error: --topic required (code|table|tailwind|landing-page|design-system)");
          process.exit(1);
        }
        result = await client.callTool("get_guidelines", { topic });
        break;
      }

      case "get_style_guide_tags":
      case "style-tags": {
        result = await client.callTool("get_style_guide_tags", {});
        break;
      }

      case "get_style_guide":
      case "style-guide": {
        const params: Record<string, unknown> = {};
        if (options["tags"]) params.tags = parseJsonArg(options["tags"]);
        if (options["id"]) params.id = options["id"];
        result = await client.callTool("get_style_guide", params);
        break;
      }

      case "batch_get":
      case "get": {
        const params: Record<string, unknown> = {
          filePath: options["file"] || "",
        };
        if (options["patterns"]) params.patterns = parseJsonArg(options["patterns"]);
        if (options["node-ids"]) params.nodeIds = parseJsonArg(options["node-ids"]);
        if (options["parent-id"]) params.parentId = options["parent-id"];
        if (options["read-depth"]) params.readDepth = parseInt(options["read-depth"]);
        if (options["search-depth"]) params.searchDepth = parseInt(options["search-depth"]);
        if (options["include-path-geometry"] === "true") params.includePathGeometry = true;
        if (options["resolve-instances"] === "true") params.resolveInstances = true;
        if (options["resolve-variables"] === "true") params.resolveVariables = true;
        result = await client.callTool("batch_get", params);
        break;
      }

      case "batch_design":
      case "design": {
        const filePath = options["file"];
        const operations = options["operations"];
        if (!filePath) {
          console.error("Error: --file required");
          process.exit(1);
        }
        if (!operations) {
          console.error("Error: --operations required");
          process.exit(1);
        }
        result = await client.callTool("batch_design", { filePath, operations });
        break;
      }

      case "snapshot_layout":
      case "layout": {
        const params: Record<string, unknown> = {
          filePath: options["file"] || "",
        };
        if (options["parent-id"]) params.parentId = options["parent-id"];
        if (options["max-depth"]) params.maxDepth = parseInt(options["max-depth"]);
        if (options["problems-only"] === "true") params.problemsOnly = true;
        result = await client.callTool("snapshot_layout", params);
        break;
      }

      case "get_screenshot":
      case "screenshot": {
        const filePath = options["file"];
        const nodeId = options["node-id"];
        if (!filePath) {
          console.error("Error: --file required");
          process.exit(1);
        }
        if (!nodeId) {
          console.error("Error: --node-id required");
          process.exit(1);
        }
        result = await client.callTool("get_screenshot", { filePath, nodeId });
        break;
      }

      case "get_variables":
      case "variables": {
        const filePath = options["file"];
        if (!filePath) {
          console.error("Error: --file required");
          process.exit(1);
        }
        result = await client.callTool("get_variables", { filePath });
        break;
      }

      case "set_variables": {
        const filePath = options["file"];
        const variables = options["variables"];
        if (!filePath) {
          console.error("Error: --file required");
          process.exit(1);
        }
        if (!variables) {
          console.error("Error: --variables required (JSON)");
          process.exit(1);
        }
        const params: Record<string, unknown> = {
          filePath,
          variables: parseJsonArg(variables),
        };
        if (options["replace"] === "true") params.replace = true;
        result = await client.callTool("set_variables", params);
        break;
      }

      case "find_empty_space_on_canvas":
      case "find-space": {
        const filePath = options["file"];
        if (!filePath) {
          console.error("Error: --file required");
          process.exit(1);
        }
        const params: Record<string, unknown> = {
          filePath,
          width: parseInt(options["width"] || "100"),
          height: parseInt(options["height"] || "100"),
          padding: parseInt(options["padding"] || "20"),
          direction: options["direction"] || "right",
        };
        if (options["node-id"]) params.nodeId = options["node-id"];
        result = await client.callTool("find_empty_space_on_canvas", params);
        break;
      }

      case "search_all_unique_properties":
      case "search-props": {
        const filePath = options["file"];
        const parents = options["parents"];
        const properties = options["properties"];
        if (!filePath || !parents || !properties) {
          console.error("Error: --file, --parents (JSON array), and --properties (JSON array) required");
          process.exit(1);
        }
        result = await client.callTool("search_all_unique_properties", {
          filePath,
          parents: parseJsonArg(parents),
          properties: parseJsonArg(properties),
        });
        break;
      }

      case "replace_all_matching_properties":
      case "replace-props": {
        const filePath = options["file"];
        const parents = options["parents"];
        const properties = options["properties"];
        if (!filePath || !parents || !properties) {
          console.error("Error: --file, --parents (JSON array), and --properties (JSON) required");
          process.exit(1);
        }
        result = await client.callTool("replace_all_matching_properties", {
          filePath,
          parents: parseJsonArg(parents),
          properties: parseJsonArg(properties),
        });
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }

    console.log(formatResult(result));
    client.close();
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    client.close();
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
Pencil MCP CLI - Interface to Pencil.app design tool

USAGE:
  pencil.ts <command> [options]

COMMANDS:
  state, get_editor_state      Get current editor state and selection
    --include-schema           Include .pen file schema in response

  open, open_document          Open or create a .pen file
    --file <path>              Path to .pen file (or "new" for blank)

  guidelines, get_guidelines   Get design guidelines
    --topic <topic>            Required: code|table|tailwind|landing-page|design-system

  style-tags, get_style_guide_tags   Get available style guide tags

  style-guide, get_style_guide       Get style guide for design inspiration
    --tags <json-array>        Tags to filter by (from style-tags)
    --id <id>                  Specific style guide ID

  get, batch_get               Read/search nodes in a .pen file
    --file <path>              Path to .pen file
    --patterns <json>          Search patterns, e.g. '[{"reusable": true}]'
    --node-ids <json>          Node IDs to read, e.g. '["abc", "def"]'
    --parent-id <id>           Parent node to search within
    --read-depth <n>           How deep to read node tree (default: 1)
    --search-depth <n>         How deep to search
    --resolve-instances        Expand component instances
    --resolve-variables        Show computed variable values

  design, batch_design         Execute design operations
    --file <path>              Required: path to .pen file
    --operations <script>      Required: operation script (see docs)

  layout, snapshot_layout      Check layout structure
    --file <path>              Path to .pen file
    --parent-id <id>           Limit to subtree
    --max-depth <n>            Limit depth
    --problems-only            Only show layout issues

  screenshot, get_screenshot   Get screenshot of a node
    --file <path>              Required: path to .pen file
    --node-id <id>             Required: node ID to capture

  variables, get_variables     Get design tokens/themes
    --file <path>              Required: path to .pen file

  set_variables                Update design tokens/themes
    --file <path>              Required: path to .pen file
    --variables <json>         Required: variable definitions
    --replace                  Replace all (vs merge)

  find-space, find_empty_space_on_canvas   Find empty canvas area
    --file <path>              Required: path to .pen file
    --width <n>                Required space width
    --height <n>               Required space height
    --padding <n>              Minimum padding from elements
    --direction <dir>          top|right|bottom|left
    --node-id <id>             Reference node (optional)

  search-props, search_all_unique_properties   Find unique property values
    --file <path>              Required: path to .pen file
    --parents <json>           Required: parent node IDs
    --properties <json>        Required: properties to search

  replace-props, replace_all_matching_properties   Bulk replace properties
    --file <path>              Required: path to .pen file
    --parents <json>           Required: parent node IDs
    --properties <json>        Required: replacement mappings

EXAMPLES:
  # Get current editor state
  ./pencil.ts state

  # List all reusable components
  ./pencil.ts get --file ./design.pen --patterns '[{"reusable": true}]'

  # Insert a button component
  ./pencil.ts design --file ./design.pen --operations 'btn=I("parentId", {type: "ref", ref: "ButtonComp"})'

  # Take a screenshot
  ./pencil.ts screenshot --file ./design.pen --node-id "frame123"
`);
}

main();
