import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import {
	CACHE_DIR,
	disableSyncPrefs,
	findFirefox,
	findProfileByName,
	listProfileNames,
	syncProfile,
} from "./firefox.js";

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function signalFirefox(proc, signal) {
	if (process.platform === "win32") proc.kill(signal);
	else process.kill(-proc.pid, signal);
}

export async function prepareInteractiveProfile({ noProfile = false, profileName = null } = {}) {
	const profileDir = join(CACHE_DIR, "interactive-profile");
	await rm(profileDir, { recursive: true, force: true });
	await mkdir(profileDir, { recursive: true });

	if (!noProfile) {
		let source = null;
		if (profileName) {
			const match = findProfileByName(profileName);
			if (!match) {
				const available = listProfileNames();
				const suffix = available.length > 0 ? ` Available profiles: ${available.join(", ")}` : "";
				throw new Error(`Could not find Firefox profile named "${profileName}".${suffix}`);
			}
			if (match.warning) console.error(`⚠ ${match.warning}`);
			source = match.path;
		}
		syncProfile(profileDir, source);
	}

	disableSyncPrefs(profileDir);
	return profileDir;
}

export async function prepareContentProfile() {
	await mkdir(CACHE_DIR, { recursive: true });
	const profileDir = await mkdtemp(join(CACHE_DIR, "content-profile-"));
	disableSyncPrefs(profileDir);
	return profileDir;
}

export async function launchFirefox({ headless, profileDir }) {
	const firefoxBin = findFirefox();
	if (!firefoxBin) throw new Error("Could not find Firefox");

	const args = [
		...(headless ? ["--headless"] : []),
		"--no-remote",
		"--remote-debugging-port=0",
		"--profile",
		profileDir,
	];
	const proc = spawn(firefoxBin, args, {
		stdio: ["ignore", "pipe", "pipe"],
		detached: true,
	});

	try {
		const wsUrl = await new Promise((resolve, reject) => {
			const endpointPattern = /^WebDriver BiDi listening on (ws:\/\/.*)$/;
			const timer = setTimeout(
				() => reject(new Error("Timed out waiting for Firefox BiDi endpoint")),
				20_000,
			);

			function watch(stream) {
				if (!stream) return;
				const lines = createInterface(stream);
				lines.on("line", (line) => {
					const match = line.match(endpointPattern);
					if (match) {
						clearTimeout(timer);
						resolve(match[1]);
					} else if (line.trim()) {
						console.error(`[firefox] ${line}`);
					}
				});
			}

			watch(proc.stdout);
			watch(proc.stderr);
			proc.once("exit", (code, signal) => {
				clearTimeout(timer);
				reject(new Error(`Firefox exited before startup (code ${code}, signal ${signal})`));
			});
		});

		const browser = await puppeteer.connect({
			browserWSEndpoint: `${wsUrl}/session`,
			protocol: "webDriverBiDi",
			defaultViewport: null,
		});
		return { browser, proc };
	} catch (error) {
		await stopFirefox({ proc });
		throw error;
	}
}

export async function stopFirefox({ browser, proc }) {
	try { await browser?.close(); } catch {}

	if (proc && proc.exitCode === null && proc.signalCode === null) {
		try { signalFirefox(proc, "SIGTERM"); } catch {}
		await Promise.race([once(proc, "exit"), sleep(2_000)]);
	}

	if (proc && proc.exitCode === null && proc.signalCode === null) {
		try { signalFirefox(proc, "SIGKILL"); } catch {}
		await Promise.race([once(proc, "exit"), sleep(1_000)]);
	}
}
