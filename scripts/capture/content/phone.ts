/**
 * The phone's conversation: reword the last commit and force-push it, approved from the phone.
 *
 * The branch's last commit went out with a throwaway message. In one reply the agent rewrites that
 * message and pushes — and the push has to be a force push, the one step here that replaces
 * something on the remote, so it stops and asks. The shot is that question, on the phone.
 *
 * One reply with two commands rather than two replies: the phone has the status bar and the home
 * indicator to keep clear of, and the whole exchange — the question, the reply, the approval card —
 * has to fit between them.
 */

import type { Script } from "../lib/model.ts";
import type { Lang } from "./types.ts";

const words = {
	zh: {
		ask: "把最后一个提交的说明改规范再推上去。",
		title: "改写提交说明并推送",
		reply: "最后一个提交叫「wip tests」，按 Conventional Commits 改好说明。它已经推过了，所以要强推覆盖远端：",
		amend: "改写最后一个提交的说明",
		push: "强推改写后的提交",
	},
	en: {
		ask: "Reword the last commit message and push it.",
		title: "Reword last commit",
		reply: "Rewording “wip tests”. It is already on the remote, so this needs a force push:",
		amend: "Reword the last commit message",
		push: "Force-push the reworded commit",
	},
} as const;

export function phoneAsk(lang: Lang): string {
	return words[lang].ask;
}

export function phoneScript(lang: Lang): Script {
	const w = words[lang];
	return {
		cue: w.ask.slice(0, 8),
		title: w.title,
		steps: [
			{
				delay: 300,
				text: w.reply,
				tools: [
					// With the short description a model gives every command: the approval card is titled by it.
					{ name: "bash", input: { command: 'git commit --amend -m "test(sync): cover offline merge conflicts"', description: w.amend } },
					{ name: "bash", input: { command: "git push --force-with-lease origin fix/offline-merge", description: w.push } },
				],
			},
		],
		finally: { text: lang === "zh" ? "推上去了。" : "Pushed." },
	};
}
