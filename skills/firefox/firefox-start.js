#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { connect } from "./lib/connect.js";

const PORT = process.env.FIREFOX_BIDI_PORT || 9222;
const CACHE_DIR = join(process.env.HOME, ".cache", "firefox-browser-tools");
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
function findFirefox() {
	const platform = process.platform;
	if (platform === "darwin") {
		const paths = [
			"/Applications/Firefox.app/Contents/MacOS/firefox",
			`${process.env.HOME}/Applications/Firefox.app/Contents/MacOS/firefox`,
		];
		for (const p of paths) {
			if (existsSync(p)) return p;
		}
	} else if (platform === "linux") {
		const paths = ["/usr/bin/firefox", "/usr/bin/firefox-esr", "/snap/bin/firefox"];
		for (const p of paths) {
			if (existsSync(p)) return p;
		}
		// Try which
		try {
			return execSync("which firefox", { encoding: "utf-8" }).trim();
		} catch {}
	} else if (platform === "win32") {
		const paths = [
			join(process.env.PROGRAMFILES || "", "Mozilla Firefox", "firefox.exe"),
			join(process.env["PROGRAMFILES(X86)"] || "", "Mozilla Firefox", "firefox.exe"),
			join(process.env.LOCALAPPDATA || "", "Mozilla Firefox", "firefox.exe"),
		];
		for (const p of paths) {
			if (existsSync(p)) return p;
		}
	}
	return null;
}

const firefoxBin = findFirefox();
if (!firefoxBin) {
	console.error("✗ Could not find Firefox. Install it or set the path manually.");
	process.exit(1);
}

// Find and sync user profile
function findDefaultProfile() {
	const platform = process.platform;
	let profilesDir;
	if (platform === "darwin") {
		profilesDir = join(process.env.HOME, "Library", "Application Support", "Firefox");
	} else if (platform === "linux") {
		profilesDir = join(process.env.HOME, ".mozilla", "firefox");
	} else if (platform === "win32") {
		profilesDir = join(process.env.APPDATA || "", "Mozilla", "Firefox");
	}
	if (!profilesDir) return null;

	const iniPath = join(profilesDir, "profiles.ini");
	if (!existsSync(iniPath)) return null;

	const ini = readFileSync(iniPath, "utf-8");
	// Find the Install* section's Default= (the actively used profile)
	const installMatch = ini.match(/\[Install[^\]]*\][\s\S]*?Default=(.+)/);
	if (installMatch) {
		const rel = installMatch[1].trim();
		const fullPath = join(profilesDir, rel);
		if (existsSync(fullPath)) return fullPath;
	}

	// Fallback: find profile with Default=1
	const sections = ini.split(/\[Profile\d+\]/);
	for (const section of sections) {
		if (section.includes("Default=1")) {
			const pathMatch = section.match(/Path=(.+)/);
			const isRelative = section.includes("IsRelative=1");
			if (pathMatch) {
				const p = pathMatch[1].trim();
				return isRelative ? join(profilesDir, p) : p;
			}
		}
	}
	return null;
}

execSync(`mkdir -p "${PROFILE_DST}"`, { stdio: "ignore" });

// Clean lock files
try {
	execSync(`rm -f "${PROFILE_DST}/.parentlock" "${PROFILE_DST}/lock"`, { stdio: "ignore" });
} catch {}

if (!skipProfile) {
	const srcProfile = findDefaultProfile();
	if (srcProfile) {
		console.log(`Syncing profile from ${srcProfile}...`);
		execSync(
			`rsync -a --delete \
				--exclude='.parentlock' \
				--exclude='lock' \
				--exclude='crashes' \
				--exclude='datareporting' \
				--exclude='cache2' \
				--exclude='startupCache' \
				--exclude='thumbnails' \
				--exclude='safebrowsing' \
				--exclude='sessionstore*' \
				--exclude='sessionCheckpoints.json' \
				--exclude='*.sqlite-wal' \
				--exclude='*.sqlite-shm' \
				--exclude='favicons.sqlite' \
				"${srcProfile}/" "${PROFILE_DST}/"`,
			{ stdio: "pipe" },
		);
	} else {
		console.log("⚠ Could not find Firefox profile, starting fresh.");
	}
}

// Disable sync in the copied profile to avoid noisy errors
const userJs = join(PROFILE_DST, "user.js");
const syncPrefs = `
user_pref("identity.fxaccounts.enabled", false);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.enabled", false);
`;
try {
	const existing = existsSync(userJs) ? readFileSync(userJs, "utf-8") : "";
	if (!existing.includes("identity.fxaccounts.enabled")) {
		execSync(`cat >> "${userJs}" << 'PREFS'${syncPrefs}PREFS`, { stdio: "ignore" });
	}
} catch {}

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
