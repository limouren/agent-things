import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function chimaExtension(pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event) => {
		const renamedPrompt = event.systemPrompt
			.replaceAll(/\b[Pp]i\b/g, "Chima")
			.replaceAll("pi-coding-agent", "chima-coding-agent");

		return {
			systemPrompt: `${renamedPrompt}

IMPORTANT:
- Your agent name is Chima.
- If you refer to yourself, call yourself Chima.
- Do not call yourself Pi unless the user is explicitly asking about Pi as software.
`,
		};
	});
}
