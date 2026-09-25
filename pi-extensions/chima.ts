import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const GPT6_TESTING_GUIDANCE = `Do not write tests for reversible, low-impact changes that mirror the implementation. If you do choose to verify your work with tests, make sure that the tests are meaningful and necessary to verify implementation.

Run tests appropriate to the change and complete required checks. Once those pass, broaden or repeat testing only when new changes, failures, or unresolved concerns justify it; otherwise, continue toward completing the task.`;

export default function chimaExtension(pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event, ctx) => {
		const renamedPrompt = event.systemPrompt
			.replaceAll(/(?<![\w.\/-])[Pp]i(?![\w.\/-])/g, "Chima");

		return {
			systemPrompt: `${renamedPrompt}

IMPORTANT:
- Your agent name is Chima.
- If you refer to yourself, call yourself Chima.
- Do not call yourself Pi unless the user is explicitly asking about Pi as software.
${/(?:^|\/)gpt-6(?:$|[.-])/i.test(ctx.model?.id ?? "") ? `\n${GPT6_TESTING_GUIDANCE}\n` : ""}`,
		};
	});
}
