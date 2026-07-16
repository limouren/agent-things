#!/usr/bin/env node

import { ensureFirefox } from "./lib/ipc.js";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
	console.log("Usage: firefox-start.js [--no-profile] [--profile <name>]");
	process.exit(0);
}

const noProfile = process.argv.includes("--no-profile");
const profileIndex = process.argv.indexOf("--profile");
const profileName = profileIndex === -1 ? null : process.argv[profileIndex + 1];

if (profileIndex !== -1 && !profileName) {
	console.error("✗ --profile requires a profile name");
	process.exit(1);
}
if (noProfile && profileName) {
	console.error("✗ --no-profile and --profile cannot be used together");
	process.exit(1);
}

try {
	const args = [
		...(noProfile ? ["--no-profile"] : []),
		...(profileName ? ["--profile", profileName] : []),
	];
	const status = await ensureFirefox("interactive", args);
	console.log(status.started
		? "✓ Firefox started"
		: "✓ Firefox is already running");
} catch (error) {
	console.error(`✗ ${error.message}`);
	process.exitCode = 1;
}
