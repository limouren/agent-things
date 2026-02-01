#!/usr/bin/env node

import { spawn } from "node:child_process";
import { join } from "node:path";
import { connect } from "./lib/connect.js";
import { CACHE_DIR, findFirefox, syncProfile, disableSyncPrefs } from "./lib/firefox.js";

const PORT = process.env.FIREFOX_BIDI_PORT || 9222;
const PROFILE_DST = join(CACHE_DIR, "profile");

if (process.argv[2] === "--help" || process.argv[2] === "-h") {
	console.log("Usage: firefox-start.js [--no-profile]");
	console.log("\nStarts Firefox with WebDriver BiDi on port " + PORT);
	console.log("By default, copies your Firefox profile (cookies, logins).");
	console.log("\nOptions:");
	console.log("  --no-profile  Start with a fresh profile");
	process.exit(0);
}

const skipProfile = process.argv[2] === "--no-profile";

// Check if already running
try {
	const browser = await connect();
	await browser.disconnect();
	console.log(`✓ Firefox already running on :${PORT}`);
	process.exit(0);
} catch {}

// Find Firefox binary
const firefoxBin = findFirefox();
if (!firefoxBin) {
	console.error("✗ Could not find Firefox. Install it or set the path manually.");
	process.exit(1);
}

// Sync profile
if (!skipProfile) {
	const { synced } = syncProfile(PROFILE_DST);
	if (synced) {
		console.log("Profile synced.");
	} else {
		console.log("⚠ Could not find Firefox profile, starting fresh.");
	}
}

disableSyncPrefs(PROFILE_DST);

// Start Firefox
spawn(
	firefoxBin,
	[
		"--remote-debugging-port", String(PORT),
		"--profile", PROFILE_DST,
		"--no-remote",
	],
	{ detached: true, stdio: "ignore" },
).unref();

// Wait for Firefox to be ready
let connected = false;
for (let i = 0; i < 30; i++) {
	try {
		const browser = await connect();
		await browser.disconnect();
		connected = true;
		break;
	} catch {
		await new Promise((r) => setTimeout(r, 500));
	}
}

if (!connected) {
	console.error("✗ Failed to connect to Firefox");
	process.exit(1);
}

console.log(`✓ Firefox started on :${PORT}${skipProfile ? " (fresh profile)" : " with your profile"}`);
