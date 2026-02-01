#!/usr/bin/env node

import { connectOrExit as connect, activePage } from "./lib/connect.js";

const code = process.argv.slice(2).join(" ");
if (!code) {
	console.log("Usage: firefox-eval.js 'code'");
	console.log("\nExamples:");
	console.log('  firefox-eval.js "document.title"');
	console.log('  firefox-eval.js "document.querySelectorAll(\'a\').length"');
	process.exit(1);
}

const browser = await connect();
const page = await activePage(browser);

const result = await page.evaluate((c) => {
	const AsyncFunction = (async () => {}).constructor;
	return new AsyncFunction(`return (${c})`)();
}, code);

if (Array.isArray(result)) {
	for (let i = 0; i < result.length; i++) {
		if (i > 0) console.log("");
		for (const [key, value] of Object.entries(result[i])) {
			console.log(`${key}: ${value}`);
		}
	}
} else if (typeof result === "object" && result !== null) {
	for (const [key, value] of Object.entries(result)) {
		console.log(`${key}: ${value}`);
	}
} else {
	console.log(result);
}

await browser.disconnect();
