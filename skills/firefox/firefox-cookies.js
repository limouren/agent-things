#!/usr/bin/env node

import { connectOrExit as connect, activePage } from "./lib/connect.js";

const browser = await connect();
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

await browser.disconnect();
