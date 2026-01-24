#!/usr/bin/env npx tsx

/**
 * CLI tool to download images from Figma
 * 
 * Usage:
 *   ./download-images.ts <fileKey> <outputDir> '<nodesJson>'
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface NodeToDownload {
  nodeId: string;
  fileName: string;
  imageRef?: string;
}

interface DownloadResult {
  fileName: string;
  success: boolean;
  error?: string;
}

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

  async getImageFillUrls(fileKey: string): Promise<Record<string, string>> {
    const response = await this.request<{ meta: { images: Record<string, string> } }>(
      `/files/${fileKey}/images`
    );
    return response.meta.images || {};
  }

  async getNodeRenderUrls(
    fileKey: string,
    nodeIds: string[],
    format: "png" | "svg",
    scale: number = 2
  ): Promise<Record<string, string>> {
    if (nodeIds.length === 0) return {};

    let endpoint: string;
    if (format === "png") {
      endpoint = `/images/${fileKey}?ids=${nodeIds.join(",")}&format=png&scale=${scale}`;
    } else {
      endpoint = `/images/${fileKey}?ids=${nodeIds.join(",")}&format=svg&svg_outline_text=true&svg_simplify_stroke=true`;
    }

    const response = await this.request<{ images: Record<string, string | null> }>(endpoint);
    
    // Filter out null values
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.images || {})) {
      if (value) result[key] = value;
    }
    return result;
  }
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(outputPath, buffer);
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

function printUsage() {
  console.error("Usage: download-images.ts <fileKey> <outputDir> '<nodesJson>'");
  console.error("");
  console.error("Arguments:");
  console.error("  fileKey     The Figma file key");
  console.error("  outputDir   Directory to save images");
  console.error("  nodesJson   JSON array of nodes to download");
  console.error("");
  console.error("Node JSON format:");
  console.error('  [{"nodeId": "1234:5678", "fileName": "icon.svg"}]');
  console.error("");
  console.error("Node properties:");
  console.error("  nodeId      Required. Node ID (format: 1234:5678 or 1234-5678)");
  console.error("  fileName    Required. Output filename (.png or .svg)");
  console.error("  imageRef    Optional. For image fills, the imageRef value");
}

async function main() {
  const [fileKey, outputDir, nodesJson] = process.argv.slice(2);

  if (!fileKey || !outputDir || !nodesJson) {
    printUsage();
    process.exit(1);
  }

  let nodes: NodeToDownload[];
  try {
    nodes = JSON.parse(nodesJson);
    if (!Array.isArray(nodes)) {
      throw new Error("nodesJson must be an array");
    }
  } catch (err) {
    console.error(`Error parsing nodesJson: ${err instanceof Error ? err.message : String(err)}`);
    printUsage();
    process.exit(1);
  }

  // Validate nodes
  for (const node of nodes) {
    if (!node.nodeId || !node.fileName) {
      console.error("Error: Each node must have nodeId and fileName");
      process.exit(1);
    }
    if (!node.fileName.endsWith(".png") && !node.fileName.endsWith(".svg")) {
      console.error(`Error: fileName must end with .png or .svg: ${node.fileName}`);
      process.exit(1);
    }
  }

  const config = loadConfig();
  const client = new FigmaClient(config.apiKey);

  // Create output directory
  const resolvedOutputDir = resolve(outputDir);
  mkdirSync(resolvedOutputDir, { recursive: true });

  // Normalize nodeIds: replace - with :
  const normalizedNodes = nodes.map((n) => ({
    ...n,
    nodeId: n.nodeId.replace(/-/g, ":"),
  }));

  // Separate by type
  const imageFills = normalizedNodes.filter((n) => n.imageRef);
  const renderNodes = normalizedNodes.filter((n) => !n.imageRef);
  const pngNodes = renderNodes.filter((n) => n.fileName.endsWith(".png"));
  const svgNodes = renderNodes.filter((n) => n.fileName.endsWith(".svg"));

  const results: DownloadResult[] = [];

  try {
    // Download image fills
    if (imageFills.length > 0) {
      console.error(`Fetching URLs for ${imageFills.length} image fills...`);
      const fillUrls = await client.getImageFillUrls(fileKey);
      
      for (const node of imageFills) {
        const url = fillUrls[node.imageRef!];
        if (!url) {
          results.push({ fileName: node.fileName, success: false, error: "Image URL not found" });
          continue;
        }
        
        const outputPath = join(resolvedOutputDir, node.fileName);
        try {
          await downloadFile(url, outputPath);
          results.push({ fileName: node.fileName, success: true });
        } catch (err) {
          results.push({ 
            fileName: node.fileName, 
            success: false, 
            error: err instanceof Error ? err.message : String(err) 
          });
        }
      }
    }

    // Download PNG renders
    if (pngNodes.length > 0) {
      console.error(`Fetching URLs for ${pngNodes.length} PNG nodes...`);
      const pngUrls = await client.getNodeRenderUrls(
        fileKey,
        pngNodes.map((n) => n.nodeId),
        "png"
      );

      for (const node of pngNodes) {
        const url = pngUrls[node.nodeId];
        if (!url) {
          results.push({ fileName: node.fileName, success: false, error: "Render URL not found" });
          continue;
        }

        const outputPath = join(resolvedOutputDir, node.fileName);
        try {
          await downloadFile(url, outputPath);
          results.push({ fileName: node.fileName, success: true });
        } catch (err) {
          results.push({
            fileName: node.fileName,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Download SVG renders
    if (svgNodes.length > 0) {
      console.error(`Fetching URLs for ${svgNodes.length} SVG nodes...`);
      const svgUrls = await client.getNodeRenderUrls(
        fileKey,
        svgNodes.map((n) => n.nodeId),
        "svg"
      );

      for (const node of svgNodes) {
        const url = svgUrls[node.nodeId];
        if (!url) {
          results.push({ fileName: node.fileName, success: false, error: "Render URL not found" });
          continue;
        }

        const outputPath = join(resolvedOutputDir, node.fileName);
        try {
          await downloadFile(url, outputPath);
          results.push({ fileName: node.fileName, success: true });
        } catch (err) {
          results.push({
            fileName: node.fileName,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Print results
    const successCount = results.filter((r) => r.success).length;
    console.log(`Downloaded ${successCount}/${results.length} images to ${resolvedOutputDir}`);
    
    for (const result of results) {
      if (result.success) {
        console.log(`  ✓ ${result.fileName}`);
      } else {
        console.log(`  ✗ ${result.fileName}: ${result.error}`);
      }
    }

    if (successCount < results.length) {
      process.exit(1);
    }

  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
