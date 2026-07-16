import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

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

export async function extractPageContent(page, url) {
	await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
	try {
		await page.waitForNetworkIdle({ idleTime: 500, timeout: 5_000 });
	} catch {}

	const outerHTML = await page.evaluate(() => document.documentElement.outerHTML);
	const finalUrl = page.url();
	const doc = new JSDOM(outerHTML, { url: finalUrl });
	const article = new Readability(doc.window.document).parse();

	if (article?.content) {
		return { url: finalUrl, title: article.title || null, content: htmlToMarkdown(article.content) };
	}

	const fallbackDoc = new JSDOM(outerHTML, { url: finalUrl });
	const fallbackBody = fallbackDoc.window.document;
	fallbackBody
		.querySelectorAll("script, style, noscript, nav, header, footer, aside")
		.forEach((element) => element.remove());
	const main =
		fallbackBody.querySelector("main, article, [role='main'], .content, #content") ||
		fallbackBody.body;
	const fallbackHtml = main?.innerHTML || "";

	return {
		url: finalUrl,
		title: article?.title || null,
		content: fallbackHtml.trim().length > 100
			? htmlToMarkdown(fallbackHtml)
			: "(Could not extract content)",
	};
}
