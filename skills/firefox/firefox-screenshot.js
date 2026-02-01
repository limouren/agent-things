#!/usr/bin/env node

import { tmpdir } from "node:os";
import { join } from "node:path";
import { withBrowser, activePage } from "./lib/connect.js";

await withBrowser(async (browser) => {
	const page = await activePage(browser);

	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const filename = `screenshot-${timestamp}.png`;
	const filepath = join(tmpdir(), filename);

	await page.screenshot({ path: filepath });

	console.log(filepath);
});
