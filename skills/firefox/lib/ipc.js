import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CACHE_DIR } from "./firefox.js";

const RUNTIME_DIR = join(CACHE_DIR, "runtime");
const SERVICE_PATH = fileURLToPath(new URL("../firefox-service.js", import.meta.url));

function firefoxName(kind) {
	return kind === "interactive" ? "Interactive Firefox" : "Headless Firefox";
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function serviceSocketPath(kind) {
	if (process.platform === "win32") {
		return `\\\\.\\pipe\\chima-firefox-${kind}-${process.env.USERNAME || "user"}`;
	}
	return join(RUNTIME_DIR, `${kind}.sock`);
}

export async function prepareRuntimeDir() {
	await mkdir(RUNTIME_DIR, { recursive: true, mode: 0o700 });
}

export class FirefoxUnavailableError extends Error {
	constructor(kind, cause) {
		super(`${firefoxName(kind)} is unavailable`);
		this.name = "FirefoxUnavailableError";
		this.cause = cause;
	}
}

export function request(kind, method, params = {}, { timeoutMs = 120_000 } = {}) {
	return new Promise((resolve, reject) => {
		const socket = createConnection(serviceSocketPath(kind));
		let buffer = "";
		let settled = false;
		let timer;

		function finish(error, result) {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			socket.destroy();
			error ? reject(error) : resolve(result);
		}

		if (timeoutMs > 0) {
			timer = setTimeout(
				() => finish(new Error(`${method} timed out after ${timeoutMs}ms`)),
				timeoutMs,
			);
		}

		socket.setEncoding("utf8");
		socket.once("connect", () => {
			socket.write(`${JSON.stringify({ id: randomUUID(), method, params })}\n`);
		});
		socket.on("data", (chunk) => {
			buffer += chunk;
			const newline = buffer.indexOf("\n");
			if (newline === -1) return;

			try {
				const response = JSON.parse(buffer.slice(0, newline));
				if (response.ok) {
					finish(null, response.result);
				} else {
					const error = new Error(response.error?.message || "Firefox request failed");
					error.name = response.error?.name || "Error";
					finish(error);
				}
			} catch (error) {
				finish(new Error(`Invalid response from Firefox: ${error.message}`));
			}
		});
		socket.once("error", (error) => finish(new FirefoxUnavailableError(kind, error)));
		socket.once("end", () => {
			if (!settled) finish(new Error(`${firefoxName(kind)} stopped unexpectedly`));
		});
	});
}

async function firefoxIsReady(kind) {
	try {
		await request(kind, "ping", {}, { timeoutMs: 500 });
		return true;
	} catch {
		return false;
	}
}

function processIsRunning(pid) {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error.code === "EPERM";
	}
}

async function acquireStartLock(kind, timeoutMs = 60_000) {
	await prepareRuntimeDir();
	const lockDir = join(RUNTIME_DIR, `${kind}.start.lock`);
	const ownerPath = join(lockDir, "owner.json");
	const token = randomUUID();
	const startedAt = Date.now();

	while (true) {
		try {
			await mkdir(lockDir);
			await writeFile(ownerPath, JSON.stringify({ pid: process.pid, token }));
			return async () => {
				try {
					const owner = JSON.parse(await readFile(ownerPath, "utf8"));
					if (owner.token === token) await rm(lockDir, { recursive: true, force: true });
				} catch {}
			};
		} catch (error) {
			if (error.code !== "EEXIST") throw error;
		}

		try {
			const owner = JSON.parse(await readFile(ownerPath, "utf8"));
			if (!processIsRunning(owner.pid)) {
				await rm(lockDir, { recursive: true, force: true });
				continue;
			}
		} catch {
			try {
				const lockStat = await stat(lockDir);
				if (Date.now() - lockStat.mtimeMs > 1_000) {
					await rm(lockDir, { recursive: true, force: true });
					continue;
				}
			} catch {}
		}

		if (Date.now() - startedAt >= timeoutMs) {
			throw new Error(`Timed out while starting ${firefoxName(kind)}`);
		}
		await sleep(100);
	}
}

export async function ensureFirefox(kind, serviceArgs = []) {
	if (await firefoxIsReady(kind)) {
		return { ...await request(kind, "ping", {}, { timeoutMs: 1_000 }), started: false };
	}

	const release = await acquireStartLock(kind);
	try {
		if (await firefoxIsReady(kind)) {
			return { ...await request(kind, "ping", {}, { timeoutMs: 1_000 }), started: false };
		}

		await prepareRuntimeDir();
		if (process.platform !== "win32") {
			try { await unlink(serviceSocketPath(kind)); } catch (error) {
				if (error.code !== "ENOENT") throw error;
			}
		}

		const logPath = join(RUNTIME_DIR, `${kind}.log`);
		const log = await open(logPath, "w");
		const child = spawn(process.execPath, [SERVICE_PATH, kind, ...serviceArgs], {
			detached: true,
			stdio: ["ignore", log.fd, log.fd],
		});
		child.unref();
		await log.close();

		const deadline = Date.now() + 60_000;
		while (Date.now() < deadline) {
			if (await firefoxIsReady(kind)) {
				return { ...await request(kind, "ping", {}, { timeoutMs: 1_000 }), started: true };
			}
			if (child.exitCode !== null) {
				let detail;
				try {
					detail = (await readFile(logPath, "utf8"))
						.split("\n")
						.find((line) => line.startsWith("Error:"))
						?.replace(/^Error:\s*/, "");
				} catch {}
				throw new Error(detail || `${firefoxName(kind)} failed to start; see ${logPath}`);
			}
			await sleep(100);
		}
		throw new Error(`Timed out starting ${firefoxName(kind)}; see ${logPath}`);
	} finally {
		await release();
	}
}
