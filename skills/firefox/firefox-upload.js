#!/usr/bin/env node

import { resolve } from "node:path";
import { interactiveRequest } from "./lib/cli.js";

const filePath = process.argv[2];
if (!filePath) {
	console.error("Usage: firefox-upload.js <file-path>");
	process.exit(1);
}

const result = await interactiveRequest("upload", { path: resolve(filePath) });
if (result) console.log(`✓ Selected ${result.path}`);
