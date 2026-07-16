#!/usr/bin/env node

import { interactiveRequest } from "./lib/cli.js";

const cookies = await interactiveRequest("cookies");
if (!cookies) {
	// The request helper already reported an error.
} else if (cookies.length === 0) {
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
