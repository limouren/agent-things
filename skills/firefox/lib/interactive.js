import { tmpdir } from "node:os";
import { join } from "node:path";

async function activePage(browser) {
	const pages = await browser.pages();
	return pages.at(-1) || browser.newPage();
}

async function evaluate(page, code) {
	return page.evaluate((source) => {
		const AsyncFunction = (async () => {}).constructor;
		return new AsyncFunction(`return (${source})`)();
	}, code);
}

async function installWebDriverMask(page) {
	const mask = () => {
		const descriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "webdriver");
		if (!descriptor?.configurable) return;
		Object.defineProperty(Navigator.prototype, "webdriver", {
			...descriptor,
			get: () => false,
		});
	};

	await page.evaluateOnNewDocument(mask);
	await page.evaluate(mask);
}

async function pickElements(page, message) {
	await page.evaluate(() => {
		window.__chimaPick = (prompt) => new Promise((resolve) => {
			const selections = [];
			const selectedElements = new Set();
			const overlay = document.createElement("div");
			overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";

			const highlight = document.createElement("div");
			highlight.style.cssText = "position:absolute;border:2px solid #3b82f6;background:rgba(59,130,246,.1);transition:all .1s";
			overlay.appendChild(highlight);

			const banner = document.createElement("div");
			banner.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1f2937;color:white;padding:12px 24px;border-radius:8px;font:14px sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3);pointer-events:auto;z-index:2147483647";

			const updateBanner = () => {
				banner.textContent = `${prompt} (${selections.length} selected, Cmd/Ctrl+click to add, Enter to finish, ESC to cancel)`;
			};
			updateBanner();
			document.body.append(banner, overlay);

			const describe = (element) => {
				const parents = [];
				let current = element.parentElement;
				while (current && current !== document.body) {
					const id = current.id ? `#${current.id}` : "";
					const classes = typeof current.className === "string" && current.className
						? `.${current.className.trim().split(/\s+/).join(".")}`
						: "";
					parents.push(`${current.tagName.toLowerCase()}${id}${classes}`);
					current = current.parentElement;
				}
				return {
					tag: element.tagName.toLowerCase(),
					id: element.id || null,
					class: (typeof element.className === "string" ? element.className : "") || null,
					text: element.textContent?.trim().slice(0, 200) || null,
					html: element.outerHTML.slice(0, 500),
					parents: parents.join(" > "),
				};
			};

			const cleanup = () => {
				document.removeEventListener("mousemove", onMove, true);
				document.removeEventListener("click", onClick, true);
				document.removeEventListener("keydown", onKey, true);
				overlay.remove();
				banner.remove();
				for (const element of selectedElements) element.style.outline = "";
				delete window.__chimaPick;
			};

			const onMove = (event) => {
				const element = document.elementFromPoint(event.clientX, event.clientY);
				if (!element || overlay.contains(element) || banner.contains(element)) return;
				const rect = element.getBoundingClientRect();
				highlight.style.top = `${rect.top}px`;
				highlight.style.left = `${rect.left}px`;
				highlight.style.width = `${rect.width}px`;
				highlight.style.height = `${rect.height}px`;
			};

			const onClick = (event) => {
				if (banner.contains(event.target)) return;
				event.preventDefault();
				event.stopPropagation();
				const element = document.elementFromPoint(event.clientX, event.clientY);
				if (!element || overlay.contains(element) || banner.contains(element)) return;

				if (event.metaKey || event.ctrlKey) {
					if (!selectedElements.has(element)) {
						selectedElements.add(element);
						element.style.outline = "3px solid #10b981";
						selections.push(describe(element));
						updateBanner();
					}
					return;
				}

				const result = selections.length > 0 ? selections : describe(element);
				cleanup();
				resolve(result);
			};

			const onKey = (event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					cleanup();
					resolve(null);
				} else if (event.key === "Enter" && selections.length > 0) {
					event.preventDefault();
					cleanup();
					resolve(selections);
				}
			};

			document.addEventListener("mousemove", onMove, true);
			document.addEventListener("click", onClick, true);
			document.addEventListener("keydown", onKey, true);
		});
	});

	return page.evaluate((prompt) => window.__chimaPick(prompt), message);
}

export async function handleInteractiveRequest(browser, method, params, options = {}) {
	switch (method) {
		case "navigate": {
			const page = params.newTab ? await browser.newPage() : await activePage(browser);
			if (options.maskWebDriver) await installWebDriverMask(page);
			await page.goto(params.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
			return { url: page.url(), newTab: Boolean(params.newTab) };
		}
		case "evaluate":
			return evaluate(await activePage(browser), params.code);
		case "screenshot": {
			const page = await activePage(browser);
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const path = join(tmpdir(), `firefox-screenshot-${timestamp}.png`);
			await page.screenshot({ path });
			return { path };
		}
		case "cookies":
			return (await activePage(browser)).cookies();
		case "upload": {
			const page = await activePage(browser);
			const [chooser] = await Promise.all([
				page.waitForFileChooser({ timeout: 10_000 }),
				page.evaluate(() => {
					const control = [...document.querySelectorAll("a, span, button, label")]
						.find((element) => element.textContent.trim() === "Upload Files");
					if (control) return control.click();
					const input = document.querySelector("input[type=file]");
					if (!input) throw new Error("No file upload control found");
					input.click();
				}),
			]);
			await chooser.accept([params.path]);
			return { path: params.path };
		}
		case "pick":
			return pickElements(await activePage(browser), params.message);
		default:
			throw new Error(`Unknown interactive method: ${method}`);
	}
}
