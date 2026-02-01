#!/usr/bin/env node

import { withBrowser, activePage } from "./lib/connect.js";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: firefox-upload.js <file-path>");
  process.exit(1);
}

await withBrowser(async (browser) => {
  const page = await activePage(browser);

  console.log("Setting up file chooser listener...");
  const [fileChooser] = await Promise.all([
    page.waitForFileChooser({ timeout: 10000 }),
    page.evaluate(() => {
      // Click the "Upload Files" link
      var links = document.querySelectorAll("a, span, button, label");
      for (var i = 0; i < links.length; i++) {
        if (links[i].textContent.trim() === "Upload Files") {
          links[i].click();
          return "clicked Upload Files";
        }
      }
      // Fallback: click the file input
      var input = document.querySelector("input[type=file]");
      if (input) input.click();
      return "clicked file input";
    }),
  ]);

  console.log("File chooser opened, accepting file:", filePath);
  await fileChooser.accept([filePath]);
  console.log("✓ File selected successfully");
});
