/**
 * The phone's conversation: reword the last commit and force-push it, approved from the phone.
 *
 * The branch's last commit went out with a throwaway message. The agent rewrites that message and then
 * needs to force-push — the one step here that replaces
 * something on the remote, so it stops and asks. The shot is that question, on the phone.
 */

import type { Script } from "../lib/model.ts";
import type { Lang } from "./types.ts";

const words = {
	zh: {
		ask: "把最后一个提交的说明改规范再推上去。",
		title: "改写提交说明并推送",
		amend: "最后一个提交叫「wip tests」，改成 Conventional Commits 的格式：",
		push: "这个提交已经推过了，改写之后要强推才能覆盖远端：",
	},
	en: {
		ask: "Reword the last commit properly and push it.",
		title: "Reword last commit",
		amend: "The last commit is “wip tests”. Rewording it in Conventional Commits style:",
		push: "That commit is already on the remote, so replacing it takes a force push:",
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
			{ delay: 300, text: w.amend, tools: [{ name: "bash", input: { command: 'git commit --amend -m "test(sync): cover offline merge conflicts"' } }] },
			{ delay: 300, text: w.push, tools: [{ name: "bash", input: { command: "git push --force-with-lease origin fix/offline-merge" } }] },
		],
		finally: { text: lang === "zh" ? "推上去了。" : "Pushed." },
	};
}
