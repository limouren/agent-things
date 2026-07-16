#!/usr/bin/env node

import { FirefoxUnavailableError, request } from "./lib/ipc.js";

try {
	await request("interactive", "stop", {}, { timeoutMs: 5_000 });
	console.log("✓ Firefox stopped");
} catch (error) {
	if (error instanceof FirefoxUnavailableError) {
		console.log("Firefox is not running");
	} else {
		console.error(`✗ ${error.message}`);
		process.exitCode = 1;
	}
}
