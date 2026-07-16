#!/usr/bin/env node

import { interactiveRequest, printValue } from "./lib/cli.js";

const code = process.argv.slice(2).join(" ");
if (!code) {
	console.error("Usage: firefox-eval.js 'code'");
	process.exit(1);
}

const result = await interactiveRequest("evaluate", { code });
if (process.exitCode !== 1) printValue(result);
