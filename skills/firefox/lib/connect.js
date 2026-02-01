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
	const page = pages.at(-1);
	if (!page) {
		console.error("✗ No active tab found");
		process.exit(1);
	}
	return page;
}
