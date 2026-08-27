#!/usr/bin/env node

import { chmod, rm, unlink } from "node:fs/promises";
import { createServer } from "node:net";
import {
	launchFirefox,
	prepareContentProfile,
	prepareInteractiveProfile,
	stopFirefox,
} from "./lib/browser-runtime.js";
import { extractPageContent } from "./lib/content.js";
import { handleInteractiveRequest } from "./lib/interactive.js";
import { prepareRuntimeDir, serviceSocketPath } from "./lib/ipc.js";

const kind = process.argv[2];
if (!new Set(["interactive", "content"]).has(kind)) {
	console.error("This is an internal Firefox service.");
	process.exit(1);
}

function option(name) {
	const index = process.argv.indexOf(name);
	return index === -1 ? null : process.argv[index + 1];
}

function positiveInteger(value, fallback) {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function serialize(value) {
	return JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item);
}

class Semaphore {
	#available;
	#waiting = [];

	constructor(limit) {
		this.#available = limit;
	}

	async acquire() {
		if (this.#available > 0) {
			this.#available -= 1;
			return;
		}
		await new Promise((resolve) => this.#waiting.push(resolve));
	}

	release() {
		const next = this.#waiting.shift();
		if (next) next();
		else this.#available += 1;
	}
}

function withTimeout(promise, timeoutMs, label) {
	let timer;
	return Promise.race([
		promise,
		new Promise((_, reject) => {
			timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
		}),
	]).finally(() => clearTimeout(timer));
}

const noProfile = process.argv.includes("--no-profile");
const profileName = option("--profile");
const idleMs = positiveInteger(process.env.FIREFOX_CONTENT_IDLE_MS, 60_000);
const contentConcurrency = positiveInteger(process.env.FIREFOX_CONTENT_CONCURRENCY, 4);
const contentTimeoutMs = positiveInteger(process.env.FIREFOX_CONTENT_TIMEOUT_MS, 60_000);
const maskWebDriver = process.env.FIREFOX_MASK_WEBDRIVER === "1";
const socketPath = serviceSocketPath(kind);

let browser;
let firefoxProc;
let profileDir;
let server;
let shuttingDown = false;
let idleTimer;
let activeContentRequests = 0;
let interactiveQueue = Promise.resolve();
const contentSlots = new Semaphore(contentConcurrency);

async function shutdown(exitCode = 0) {
	if (shuttingDown) return;
	shuttingDown = true;
	clearTimeout(idleTimer);
	try { server?.close(); } catch {}
	await stopFirefox({ browser, proc: firefoxProc });
	if (kind === "content" && profileDir) {
		await rm(profileDir, { recursive: true, force: true });
	}
	if (process.platform !== "win32") {
		try { await unlink(socketPath); } catch {}
	}
	process.exit(exitCode);
}

function scheduleContentShutdown() {
	clearTimeout(idleTimer);
	if (kind !== "content" || activeContentRequests > 0) return;
	idleTimer = setTimeout(() => shutdown(0), idleMs);
	idleTimer.unref();
}

async function handleContentRequest(params) {
	activeContentRequests += 1;
	clearTimeout(idleTimer);
	await contentSlots.acquire();
	let context;
	try {
		context = await browser.createBrowserContext();
		const page = await context.newPage();
		return await withTimeout(
			extractPageContent(page, params.url),
			contentTimeoutMs,
			"Content extraction",
		);
	} finally {
		try { await context?.close(); } catch {}
		contentSlots.release();
		activeContentRequests -= 1;
		scheduleContentShutdown();
	}
}

async function dispatch(method, params) {
	if (method === "ping") {
		return {
			kind,
			pid: process.pid,
			firefoxPid: firefoxProc.pid,
			activeRequests: kind === "content" ? activeContentRequests : undefined,
		};
	}

	if (method === "stop") {
		setTimeout(() => shutdown(0), 25);
		return { stopped: true };
	}

	if (kind === "content") {
		if (method !== "extract") throw new Error(`Unknown content method: ${method}`);
		return handleContentRequest(params);
	}

	const job = interactiveQueue.then(() => handleInteractiveRequest(browser, method, params, { maskWebDriver }));
	interactiveQueue = job.catch(() => {});
	return job;
}

function handleConnection(socket) {
	let buffer = "";
	socket.setEncoding("utf8");
	socket.on("error", (error) => console.error(error.message));
	socket.on("data", (chunk) => {
		buffer += chunk;
		const newline = buffer.indexOf("\n");
		if (newline === -1) return;
		socket.removeAllListeners("data");

		let request;
		try {
			request = JSON.parse(buffer.slice(0, newline));
		} catch (error) {
			socket.end(`${serialize({ ok: false, error: { name: error.name, message: error.message } })}\n`);
			return;
		}

		dispatch(request.method, request.params || {})
			.then((result) => socket.end(`${serialize({ id: request.id, ok: true, result })}\n`))
			.catch((error) => {
				console.error(error.stack || error.message);
				socket.end(`${serialize({
					id: request.id,
					ok: false,
					error: { name: error.name, message: error.message },
				})}\n`);
			});
	});
}

async function main() {
	await prepareRuntimeDir();
	if (process.platform !== "win32") {
		try { await unlink(socketPath); } catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}

	profileDir = kind === "content"
		? await prepareContentProfile()
		: await prepareInteractiveProfile({ noProfile, profileName });
	({ browser, proc: firefoxProc } = await launchFirefox({
		headless: kind === "content",
		profileDir,
	}));

	firefoxProc.once("exit", () => shutdown(0));
	server = createServer(handleConnection);
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(socketPath, resolve);
	});
	server.on("error", (error) => {
		console.error(error.stack || error.message);
		shutdown(1);
	});
	if (process.platform !== "win32") await chmod(socketPath, 0o600);
	scheduleContentShutdown();
}

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));
process.once("uncaughtException", (error) => {
	console.error(error.stack || error.message);
	shutdown(1);
});
process.once("unhandledRejection", (error) => {
	console.error(error?.stack || error);
	shutdown(1);
});

try {
	await main();
} catch (error) {
	console.error(error.stack || error.message);
	await shutdown(1);
}
