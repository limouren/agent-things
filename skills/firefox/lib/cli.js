import { FirefoxUnavailableError, request } from "./ipc.js";

export function printValue(value) {
	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index += 1) {
			if (index > 0) console.log("");
			printValue(value[index]);
		}
		return;
	}

	if (value && typeof value === "object") {
		for (const [key, item] of Object.entries(value)) {
			console.log(`${key}: ${item}`);
		}
		return;
	}

	console.log(value);
}

export async function interactiveRequest(method, params = {}, options = {}) {
	try {
		return await request("interactive", method, params, options);
	} catch (error) {
		if (error instanceof FirefoxUnavailableError) {
			console.error("✗ Firefox is not running. Run firefox-start.js first.");
		} else {
			console.error(`✗ ${error.message}`);
		}
		process.exitCode = 1;
		return undefined;
	}
}
