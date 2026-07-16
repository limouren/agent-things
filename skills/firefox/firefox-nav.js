#!/usr/bin/env node

import { interactiveRequest } from "./lib/cli.js";

const url = process.argv[2];
const newTab = process.argv.includes("--new");
if (!url) {
	console.error("Usage: firefox-nav.js <url> [--new]");
	process.exit(1);
}

const result = await interactiveRequest("navigate", { url, newTab });
if (result) console.log(`${newTab ? "✓ Opened" : "✓ Navigated to"}: ${result.url}`);
