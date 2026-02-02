import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

export const CACHE_DIR = join(process.env.HOME, ".cache", "firefox-skill");

/**
 * Get the Firefox profiles directory for the current platform.
 */
export function getProfilesDir() {
	const platform = process.platform;
	if (platform === "darwin") {
		return join(process.env.HOME, "Library", "Application Support", "Firefox");
	} else if (platform === "linux") {
		return join(process.env.HOME, ".mozilla", "firefox");
	} else if (platform === "win32") {
		return join(process.env.APPDATA || "", "Mozilla", "Firefox");
	}
	return null;
}

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
	const profilesDir = getProfilesDir();
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
 * Find a Firefox profile by its display name (from the new Firefox Profiles feature).
 * Searches Profile Groups SQLite databases for a matching name.
 * Returns { path, warning? } or null if not found.
 */
export function findProfileByName(name) {
	const profilesDir = getProfilesDir();
	if (!profilesDir) return null;

	const groupsDir = join(profilesDir, "Profile Groups");
	if (!existsSync(groupsDir)) return null;

	const sqliteFiles = readdirSync(groupsDir).filter((f) => f.endsWith(".sqlite"));
	const matches = [];

	for (const file of sqliteFiles) {
		const dbPath = join(groupsDir, file);
		let db;
		try {
			db = new Database(dbPath, { readonly: true });
			const rows = db.prepare("SELECT path, name FROM Profiles WHERE name = ?").all(name);
			for (const row of rows) {
				const fullPath = join(profilesDir, row.path);
				if (existsSync(fullPath)) {
					matches.push({ path: fullPath, name: row.name, source: file });
				}
			}
		} catch {
			// Skip databases that can't be opened or don't have the Profiles table
		} finally {
			if (db) db.close();
		}
	}

	if (matches.length === 0) return null;

	const result = { path: matches[0].path };
	if (matches.length > 1) {
		result.warning = `Found ${matches.length} profiles named "${name}", using the first one (${matches[0].path})`;
	}
	return result;
}

/**
 * List all profile display names from the Profile Groups databases.
 * Returns an array of strings.
 */
export function listProfileNames() {
	const profilesDir = getProfilesDir();
	if (!profilesDir) return [];

	const groupsDir = join(profilesDir, "Profile Groups");
	if (!existsSync(groupsDir)) return [];

	const sqliteFiles = readdirSync(groupsDir).filter((f) => f.endsWith(".sqlite"));
	const names = [];

	for (const file of sqliteFiles) {
		const dbPath = join(groupsDir, file);
		let db;
		try {
			db = new Database(dbPath, { readonly: true });
			const rows = db.prepare("SELECT path, name FROM Profiles").all();
			for (const row of rows) {
				const fullPath = join(profilesDir, row.path);
				if (existsSync(fullPath)) {
					names.push(row.name);
				}
			}
		} catch {
			// Skip databases that can't be opened or don't have the Profiles table
		} finally {
			if (db) db.close();
		}
	}

	return names;
}

/**
 * Sync user's Firefox profile to a destination directory.
 * Optionally accepts a source profile path; defaults to the default profile.
 * Returns the destination path.
 */
export function syncProfile(destDir, srcProfileOverride = null) {
	execSync(`mkdir -p "${destDir}"`, { stdio: "ignore" });

	// Clean lock files
	try {
		execSync(`rm -f "${destDir}/.parentlock" "${destDir}/lock"`, { stdio: "ignore" });
	} catch {}

	const srcProfile = srcProfileOverride || findDefaultProfile();
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
