#!/usr/bin/env node

import { connectOrExit as connect } from "./lib/connect.js";

const url = process.argv[2];
const newTab = process.argv[3] === "--new";

if (!url) {
	console.log("Usage: firefox-nav.js <url> [--new]");
	console.log("\nExamples:");
	console.log("  firefox-nav.js https://example.com       # Navigate current tab");
	console.log("  firefox-nav.js https://example.com --new # Open in new tab");
	process.exit(1);
}

const browser = await connect();

if (newTab) {
	const page = await browser.newPage();
	await page.goto(url, { waitUntil: "domcontentloaded" });
	console.log("✓ Opened:", url);
} else {
	const pages = await browser.pages();
	const page = pages.at(-1);
	await page.goto(url, { waitUntil: "domcontentloaded" });
	console.log("✓ Navigated to:", url);
}

await browser.disconnect();
