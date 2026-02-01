#!/usr/bin/env node

import { withBrowser, activePage } from "./lib/connect.js";

await withBrowser(async (browser) => {
	const page = await activePage(browser);

	const cookies = await page.cookies();

	if (cookies.length === 0) {
		console.log("(no cookies)");
	} else {
		for (const cookie of cookies) {
			console.log(`${cookie.name}: ${cookie.value}`);
			console.log(`  domain: ${cookie.domain}`);
			console.log(`  path: ${cookie.path}`);
			console.log(`  httpOnly: ${cookie.httpOnly}`);
			console.log(`  secure: ${cookie.secure}`);
			console.log("");
		}
	}
});
