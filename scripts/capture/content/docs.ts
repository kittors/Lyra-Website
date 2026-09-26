/**
 * A short conversation that ends in a link to the project's sync design document — the link the
 * file-preview shot clicks to open the rendered Markdown beside the conversation.
 */

import type { Script } from "../lib/model.ts";
import type { Lang } from "./types.ts";

const words = {
	zh: {
		ask: "同步冲突是怎么合并的？设计文档写在哪？",
		title: "同步冲突的合并方式",
		answer: [
			"设计写在 [docs/sync-design.md](docs/sync-design.md)，核心是两件事：",
			"",
			"1. **按块三方合并**：只有一边改了的块采用那一边，两边都改了的块取较晚的一次",
			"2. **混合逻辑时钟（HLC）**：墙上时间加计数器，设备时钟的快慢不影响先后顺序",
			"",
			"实现分别在 `src/sync/blocks.ts` 和 `src/sync/hlc.ts`。文档里有一张时序图，画的是两台设备离线后怎么收敛到同一个版本。",
		].join("\n"),
	},
	en: {
		ask: "How are sync conflicts merged? Where is the design written down?",
		title: "How sync conflicts are merged",
		answer: [
			"It is in [docs/sync-design.md](docs/sync-design.md). Two ideas carry it:",
			"",
			"1. **Block-level three-way merge**: a block changed on one side takes that side; changed on both, the later edit wins",
			"2. **Hybrid logical clock (HLC)**: wall time plus a counter, so a fast or slow device clock cannot reorder edits",
			"",
			"They live in `src/sync/blocks.ts` and `src/sync/hlc.ts`. The document has a sequence diagram of two offline devices converging on one version.",
		].join("\n"),
	},
} as const;

export function docsAsk(lang: Lang): string {
	return words[lang].ask;
}

export function docsScript(lang: Lang): Script {
	const w = words[lang];
	return {
		cue: w.ask.slice(0, 10),
		title: w.title,
		steps: [
			{ delay: 300, tools: [{ name: "grep", input: { pattern: "merge", path: "docs" } }, { name: "read", input: { path: "docs/sync-design.md" } }] },
			{ delay: 300, text: w.answer, rate: 45 },
		],
	};
}
