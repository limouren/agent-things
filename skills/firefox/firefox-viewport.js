#!/usr/bin/env node

import { parseArgs } from "node:util";
import { interactiveRequest } from "./lib/cli.js";

const USAGE = "Usage: firefox-viewport.js --width <px> --height <px> [--dpr <ratio>]\n       firefox-viewport.js --reset";

function fail(message) {
	console.error(`✗ ${message}`);
	console.error(USAGE);
	process.exit(1);
}

function parsePositive(name, value) {
	const number = Number(value);
	if (!Number.isFinite(number) || number <= 0) {
		fail(`--${name} must be a positive number, got ${value}`);
	}
	return number;
}

let values;
try {
	({ values } = parseArgs({
		options: {
			width: { type: "string" },
			height: { type: "string" },
			dpr: { type: "string" },
			reset: { type: "boolean" },
		},
	}));
} catch (error) {
	if (!error.code?.startsWith("ERR_PARSE_ARGS_")) {
		throw error;
	}
	fail(error.message);
}

let params;
if (values.reset) {
	if (values.width || values.height || values.dpr) {
		fail("--reset cannot be used with other options");
	}
	params = { reset: true };
} else {
	if (!values.width || !values.height) {
		fail("--width and --height are required");
	}
	params = {
		width: Math.round(parsePositive("width", values.width)),
		height: Math.round(parsePositive("height", values.height)),
	};
	if (values.dpr) {
		params.deviceScaleFactor = parsePositive("dpr", values.dpr);
	}
}

const result = await interactiveRequest("viewport", params);
if (process.exitCode !== 1) {
	if (result) {
		const dpr = result.deviceScaleFactor ? ` @ ${result.deviceScaleFactor}x` : "";
		console.log(`✓ Viewport set to ${result.width}x${result.height}${dpr}`);
	} else {
		console.log("✓ Viewport reset");
	}
}
