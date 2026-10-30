#!/usr/bin/env node

import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { interactiveRequest } from "./lib/cli.js";

const USAGE = "Usage: firefox-screenshot.js [--selector <css>] [--full-page] [--path <file>]";

function fail(message) {
	console.error(`✗ ${message}`);
	console.error(USAGE);
	process.exit(1);
}

let values;
try {
	({ values } = parseArgs({
		options: {
			selector: { type: "string" },
			path: { type: "string" },
			"full-page": { type: "boolean" },
		},
	}));
} catch (error) {
	if (!error.code?.startsWith("ERR_PARSE_ARGS_")) {
		throw error;
	}
	fail(error.message);
}

if (values.selector && values["full-page"]) {
	fail("--selector and --full-page cannot be used together");
}

const params = {};
if (values.selector) {
	params.selector = values.selector;
}
if (values.path) {
	// The service process writes the file, and its working directory differs from the caller's.
	params.path = resolve(values.path);
}
if (values["full-page"]) {
	params.fullPage = true;
}

const result = await interactiveRequest("screenshot", params);
if (result) {
	console.log(result.path);
}
