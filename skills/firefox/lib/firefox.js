import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CACHE_DIR = join(process.env.HOME, ".cache", "firefox-skill");

export function findFirefox() {
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

export function findDefaultProfile() {
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

/**
 * Sync user's Firefox profile to a destination directory.
 * Returns the destination path.
 */
export function syncProfile(destDir) {
	execSync(`mkdir -p "${destDir}"`, { stdio: "ignore" });

	// Clean lock files
	try {
		execSync(`rm -f "${destDir}/.parentlock" "${destDir}/lock"`, { stdio: "ignore" });
	} catch {}

	const srcProfile = findDefaultProfile();
	if (srcProfile) {
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
				"${srcProfile}/" "${destDir}/"`,
			{ stdio: "pipe" },
		);
		return { profileDir: destDir, synced: true };
	}
	return { profileDir: destDir, synced: false };
}

/**
 * Write prefs to disable sync/telemetry in a profile directory.
 */
export function disableSyncPrefs(profileDir) {
	const userJs = join(profileDir, "user.js");
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
}
