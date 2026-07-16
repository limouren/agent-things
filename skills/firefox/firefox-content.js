#!/usr/bin/env node

import { ensureFirefox, request } from "./lib/ipc.js";

const url = process.argv[2];
if (!url) {
	console.error("Usage: firefox-content.js <url>");
	process.exit(1);
}

try {
	await ensureFirefox("content");
	const result = await request("content", "extract", { url }, { timeoutMs: 300_000 });
	console.log(`URL: ${result.url}`);
	if (result.title) console.log(`Title: ${result.title}`);
	console.log("");
	console.log(result.content);
} catch (error) {
	console.error(`✗ ${error.message}`);
	process.exitCode = 1;
}
