import puppeteer from "puppeteer-core";

const PORT = process.env.FIREFOX_BIDI_PORT || 9222;

export async function connect() {
	return Promise.race([
		puppeteer.connect({
			browserWSEndpoint: `ws://127.0.0.1:${PORT}/session`,
			protocol: "webDriverBiDi",
			defaultViewport: null,
		}),
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error("timeout")), 5000),
		),
	]);
}

export async function connectOrExit() {
	try {
		return await connect();
	} catch (e) {
		console.error("✗ Could not connect to Firefox:", e.message);
		console.error("  Run: firefox-start.js");
		process.exit(1);
	}
}

export async function activePage(browser) {
	const pages = await browser.pages();
	if (!pages.length) {
		console.error("✗ No active tab found");
		process.exit(1);
	}

	// Use BiDi getTree to find top-level browsing contexts (excludes iframes)
	const tree = await browser.connection.send("browsingContext.getTree", {});
	const topLevelIds = new Set(tree.result.contexts.map((c) => c.context));

	const topLevelPages = pages.filter((p) =>
		topLevelIds.has(p.mainFrame().browsingContext.id),
	);

	const page = topLevelPages.at(-1) || pages.at(-1);
	if (!page) {
		console.error("✗ No active tab found");
		process.exit(1);
	}
	return page;
}

export async function withBrowser(fn) {
	let browser;
	try {
		browser = await connectOrExit();
		await fn(browser);
	} finally {
		await browser?.disconnect();
	}
}
