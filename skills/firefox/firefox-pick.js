#!/usr/bin/env node

import { interactiveRequest, printValue } from "./lib/cli.js";

const message = process.argv.slice(2).join(" ");
if (!message) {
	console.error("Usage: firefox-pick.js 'message'");
	process.exit(1);
}

const result = await interactiveRequest("pick", { message }, { timeoutMs: 0 });
if (process.exitCode === 1) {
	// The request helper already reported the error.
} else if (result === null) {
	console.log("(cancelled)");
} else {
	printValue(result);
}
