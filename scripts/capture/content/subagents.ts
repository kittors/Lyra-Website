/**
 * Several sub-agents at work at once: the pre-release checks for `aurora-notes` v0.15.0.
 *
 * The lead agent sends four independent checks out in one reply — two `verify` agents (the test
 * suite, the type check), a `review` agent on the sync module, and a `general` agent drafting the
 * changelog. With three allowed at a time, three run and one waits its turn. The sub-agents really
 * run: the verifiers' commands are the project's own (held mid-run), the reviewer reads and
 * searches the real files, one step at a time.
 */

import type { Heard, Reply, Script } from "../lib/model.ts";
import type { Lang } from "./types.ts";

const never = new Promise<void>(() => {});

const words = {
	zh: {
		ask: "准备发 v0.15.0。分几路并行检查：跑测试和类型检查、审查同步模块的改动、整理更新日志。",
		title: "v0.15.0 发布前检查",
		lead: "四项检查互不依赖，分四路并行：",
		tasks: [
			{ description: "跑完整测试", subagent_type: "verify", prompt: "在项目根目录运行 npx vitest run，报告通过与失败的数量。" },
			{ description: "类型检查", subagent_type: "verify", prompt: "运行 npx tsc --noEmit，报告所有类型错误。" },
			{ description: "审查同步模块", subagent_type: "review", prompt: "审查 src/sync 这次的改动：合并逻辑、时钟比较和离线队列，只报具体缺陷。" },
			{ description: "整理 0.15.0 更新日志", subagent_type: "general", prompt: "根据最近的提交整理 CHANGELOG.md 里 0.15.0 这一节。" },
		],
		review: [
			"先看合并和时钟两处的实现。",
			"`mergeNote` 已经按块合并了。确认 `compareHlc` 的每个调用方传的都是同一种时钟：",
			"调用方都没问题。离线队列合并前取的是 `bases` 表，看它什么时候写入：",
			"`bases` 在合并后和笔记一起写入，事务里没有遗漏。最后核对一下 `tick` 在时钟回拨时的行为：",
		],
	},
	en: {
		ask: "Getting v0.15.0 ready. Check it in parallel: tests and a type check, a review of the sync changes, and the changelog.",
		title: "Pre-release checks for v0.15.0",
		lead: "Four independent checks, so they run in parallel:",
		tasks: [
			{ description: "Run the full test suite", subagent_type: "verify", prompt: "Run npx vitest run from the project root and report how many passed and failed." },
			{ description: "Type check", subagent_type: "verify", prompt: "Run npx tsc --noEmit and report every type error." },
			{ description: "Review the sync module", subagent_type: "review", prompt: "Review this release's changes under src/sync — the merge, the clock comparison and the offline queue. Report concrete defects only." },
			{ description: "Draft the 0.15.0 changelog", subagent_type: "general", prompt: "Draft the 0.15.0 section of CHANGELOG.md from the recent commits." },
		],
		review: [
			"Starting with the merge and the clock.",
			"`mergeNote` merges per block now. Checking that every caller of `compareHlc` passes the same kind of clock:",
			"The callers are fine. The offline queue reads the `bases` table before merging — when is it written?",
			"`bases` is written with the note after a merge, inside one transaction. Last, how `tick` behaves when the wall clock goes backwards:",
		],
	},
} as const;

export function releaseAsk(lang: Lang): string {
	return words[lang].ask;
}

export function releaseTasks(lang: Lang) {
	return words[lang].tasks;
}

export function releaseScript(lang: Lang): Script {
	const w = words[lang];
	return {
		cue: w.ask.slice(0, 12),
		title: w.title,
		steps: [{ text: w.lead, delay: 400, tools: w.tasks.map((task) => ({ name: "task", input: { ...task } })) }],
		// The checks never come back while the picture is taken.
		finally: { hold: never },
	};
}

/** What each sub-agent does, one step per request, found by the task it was given. */
export function subAgentRoute(lang: Lang): (heard: Heard) => Reply | undefined {
	const tasks = words[lang].tasks;
	const review = words[lang].review;
	const plays: Record<string, Reply[]> = {
		[tasks[0].prompt]: [{ delay: 700, tools: [{ name: "bash", input: { command: "npx vitest run" } }] }],
		[tasks[1].prompt]: [{ delay: 900, tools: [{ name: "bash", input: { command: "npx tsc --noEmit" } }] }],
		[tasks[2].prompt]: [
			{ delay: 800, text: review[0], tools: [{ name: "read", input: { path: "src/sync/merge.ts" } }, { name: "read", input: { path: "src/sync/blocks.ts" } }] },
			{ delay: 1200, text: review[1], tools: [{ name: "grep", input: { pattern: "compareHlc", path: "src" } }] },
			{ delay: 1400, text: review[2], tools: [{ name: "read", input: { path: "src/sync/queue.ts" } }] },
			{ delay: 1400, text: review[3], tools: [{ name: "read", input: { path: "src/sync/hlc.ts" } }] },
		],
		[tasks[3].prompt]: [
			{ delay: 700, tools: [{ name: "bash", input: { command: "git log --oneline -6" } }] },
			{ delay: 1200, tools: [{ name: "read", input: { path: "CHANGELOG.md" } }] },
		],
	};
	return (heard) => {
		if (heard.tools.includes("task")) return undefined;
		const given = heard.said[0] ?? "";
		const key = Object.keys(plays).find((prompt) => given.includes(prompt));
		if (!key) return undefined;
		return plays[key][heard.step] ?? { hold: never };
	};
}
