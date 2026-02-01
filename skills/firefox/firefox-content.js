#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { connect } from "./lib/connect.js";
import { CACHE_DIR, findFirefox, syncProfile, disableSyncPrefs } from "./lib/firefox.js";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

// Global timeout
const TIMEOUT = 60000;
setTimeout(() => {
	console.error("✗ Timeout after 60s");
	process.exit(1);
}, TIMEOUT).unref();

const url = process.argv[2];

if (!url) {
	console.log("Usage: firefox-content.js <url>");
	console.log("\nExtracts readable content from a URL as markdown.");
	console.log("\nExamples:");
	console.log("  firefox-content.js https://example.com");
	console.log("  firefox-content.js https://en.wikipedia.org/wiki/Rust_(programming_language)");
	process.exit(1);
}

// --- Spawn a headless Firefox, wait for BiDi endpoint, return ws URL ---

async function spawnHeadlessFirefox() {
	const firefoxBin = findFirefox();
	if (!firefoxBin) {
		console.error("✗ Could not find Firefox. Install it or set the path manually.");
		process.exit(1);
	}

	// Reuse existing cached profile; only rsync on first use
	const profileDir = join(CACHE_DIR, "profile");
	const hasCache = existsSync(profileDir) && readdirSync(profileDir).length > 0;
	if (!hasCache) {
		syncProfile(profileDir);
		disableSyncPrefs(profileDir);
	}

	const proc = spawn(
		firefoxBin,
		["--headless", "--no-remote", "--remote-debugging-port=0", "--profile", profileDir],
		{ stdio: ["ignore", "pipe", "pipe"], detached: true },
	);

	// Wait for the BiDi WebSocket URL from stdout/stderr
	const wsUrl = await new Promise((resolve, reject) => {
		const regex = /^WebDriver BiDi listening on (ws:\/\/.*)$/;
		const timer = setTimeout(() => reject(new Error("Timed out waiting for Firefox BiDi endpoint")), 15000);

		function onLine(line) {
			const m = line.match(regex);
			if (m) {
				clearTimeout(timer);
				resolve(m[1]);
			}
		}

		if (proc.stdout) createInterface(proc.stdout).on("line", onLine);
		if (proc.stderr) createInterface(proc.stderr).on("line", onLine);
		proc.on("exit", (code) => {
			clearTimeout(timer);
			reject(new Error(`Firefox exited with code ${code}`));
		});
	});

	return { proc, wsUrl };
}

// --- Connect to existing Firefox, or spawn a headless one ---

let browser, page, firefoxProc = null;

try {
	// Try connecting to existing Firefox on :9222 — open a new tab
	browser = await connect();
	page = await browser.newPage();
} catch {
	// No existing Firefox — spawn a headless one
	const { proc, wsUrl } = await spawnHeadlessFirefox();
	firefoxProc = proc;

	browser = await puppeteer.connect({
		browserWSEndpoint: wsUrl + "/session",
		protocol: "webDriverBiDi",
		defaultViewport: null,
	});
	const pages = await browser.pages();
	page = pages[0] || (await browser.newPage());
}

// --- Navigate and extract content ---

try {
	await Promise.race([
		page.goto(url, { waitUntil: "networkidle2" }),
		new Promise((r) => setTimeout(r, 15000)),
	]).catch(() => {});

	const outerHTML = await page.evaluate(() => document.documentElement.outerHTML);
	const finalUrl = page.url();

	// Extract with Readability
	const doc = new JSDOM(outerHTML, { url: finalUrl });
	const reader = new Readability(doc.window.document);
	const article = reader.parse();

	// Convert to markdown
	function htmlToMarkdown(html) {
		const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
		turndown.use(gfm);
		turndown.addRule("removeEmptyLinks", {
			filter: (node) => node.nodeName === "A" && !node.textContent?.trim(),
			replacement: () => "",
		});
		return turndown
			.turndown(html)
			.replace(/\[\\?\[\s*\\?\]\]\([^)]*\)/g, "")
			.replace(/ +/g, " ")
			.replace(/\s+,/g, ",")
			.replace(/\s+\./g, ".")
			.replace(/\n{3,}/g, "\n\n")
			.trim();
	}

	let content;
	if (article && article.content) {
		content = htmlToMarkdown(article.content);
	} else {
		const fallbackDoc = new JSDOM(outerHTML, { url: finalUrl });
		const fallbackBody = fallbackDoc.window.document;
		fallbackBody
			.querySelectorAll("script, style, noscript, nav, header, footer, aside")
			.forEach((el) => el.remove());
		const main =
			fallbackBody.querySelector("main, article, [role='main'], .content, #content") ||
			fallbackBody.body;
		const fallbackHtml = main?.innerHTML || "";
		if (fallbackHtml.trim().length > 100) {
			content = htmlToMarkdown(fallbackHtml);
		} else {
			content = "(Could not extract content)";
		}
	}

	console.log(`URL: ${finalUrl}`);
	if (article?.title) console.log(`Title: ${article.title}`);
	console.log("");
	console.log(content);
} finally {
	// Clean up
	try { await page.close(); } catch {}

	if (firefoxProc) {
		// We spawned it — kill it
		try { await browser.close(); } catch {}
		try { process.kill(-firefoxProc.pid, "SIGTERM"); } catch {}
	} else {
		// Existing Firefox — just disconnect
		try { await browser.disconnect(); } catch {}
	}
}

process.exit(0);
