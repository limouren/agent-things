#!/usr/bin/env node

import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectOrExit as connect, activePage } from "./lib/connect.js";

const browser = await connect();
const page = await activePage(browser);

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const filename = `screenshot-${timestamp}.png`;
const filepath = join(tmpdir(), filename);

await page.screenshot({ path: filepath });

console.log(filepath);

await browser.disconnect();
