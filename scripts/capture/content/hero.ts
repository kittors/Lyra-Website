/**
 * The lead conversation: an agent finding and fixing a sync bug in `aurora-notes`.
 *
 * Real tools do real work here — `read` opens the files, `edit` rewrites `mergeNote` and computes the
 * diff, `write` creates the test, and `npx vitest` runs (the project's fake runner, held on its last
 * suite so the shot catches the command still going). Only the model's decisions are scripted.
 *
 * It is written to fit one 900-pixel-tall window with nothing under the transcript's edge fades: a
 * failing test is written before the analysis (so it folds into the first row of tool work), the
 * analysis is a heading, a two-item list, the offending line and a two-row table, and the fix and
 * the test run are the two cards of the last stretch. Question to running tests, all on screen.
 */

import type { Script } from "../lib/model.ts";
import { AURORA_MERGE } from "./projects.ts";
import type { Lang } from "./types.ts";

const OLD_BODY = `  // Last writer wins.
  if (remote.updatedAt > local.updatedAt) return remote;
  return local;
}`;

const NEW_BODY = `  const blocks = mergeBlocks(base.blocks, local.blocks, remote.blocks, compareHlc);
  return { ...local, blocks, clock: maxHlc(local.clock, remote.clock) };
}`;

if (!AURORA_MERGE.includes(OLD_BODY)) throw new Error("hero script is out of step with src/sync/merge.ts");

/** `src/sync/merge.ts` once the lead conversation's fix has landed, for scenes set after it. */
export const FIXED_MERGE = AURORA_MERGE.replace(OLD_BODY, NEW_BODY);

export const MERGE_TEST = `import { describe, expect, it } from "vitest";
import { mergeNote } from "../../src/sync/merge";
import { at, note } from "../fixtures/notes";

const texts = (merged: { blocks: { text: string }[] }) => merged.blocks.map((block) => block.text);

describe("mergeNote", () => {
  it("keeps edits to different blocks from both devices", () => {
    const base = note(["# Kyoto", "Flights: TBD", "Hotel: TBD"]);
    const laptop = note(["# Kyoto", "Flights: NH 821, Oct 14", "Hotel: TBD"], at(1_000, "laptop"));
    const phone = note(["# Kyoto", "Flights: TBD", "Hotel: Ryokan Sora"], at(1_000, "phone"));
    expect(texts(mergeNote(base, laptop, phone))).toEqual(["# Kyoto", "Flights: NH 821, Oct 14", "Hotel: Ryokan Sora"]);
  });

  it("orders edits to the same block by hybrid clock, not wall time", () => {
    const base = note(["Packing list"]);
    const phone = note(["Packing list: passport"], at(4_000, "phone", 0));
    const laptop = note(["Packing list: passport, adapter"], at(4_000, "phone", 1));
    expect(texts(mergeNote(base, phone, laptop))).toEqual(["Packing list: passport, adapter"]);
  });

  it("refuses to merge two different notes", () => {
    expect(() => mergeNote(note(["a"]), note(["a"]), { ...note(["a"]), id: "n2" })).toThrow();
  });
});
`;

const words = {
	zh: {
		ask: "离线同步后丢了一边的修改，查原因修好，补上测试。",
		title: "修复离线同步丢失修改",
		todos: ["定位修改丢失的原因", "写一个能复现的测试", "改为块级合并并验证"],
		active: ["正在定位原因", "正在写复现测试", "正在修复并跑测试"],
		found: [
			"## 原因",
			"",
			"- `mergeNote` 按墙上时钟比较，后写的一方会**整篇覆盖**另一方",
			"- 块级合并和混合逻辑时钟早就导入了，只是一直没用上",
			"",
			"```typescript",
			"if (remote.updatedAt > local.updatedAt) return remote;",
			"```",
			"",
			"| 场景 | 现在 | 块级合并 + HLC |",
			"| --- | --- | --- |",
			"| 两台设备改了不同段落 | 丢掉一边 | 两边都保留 |",
			"| 手机时钟快了 3 分钟 | 较新的修改被覆盖 | 按 HLC 排序 |",
		].join("\n"),
	},
	en: {
		ask: "Offline edits vanish on sync. Fix it and add a test.",
		title: "Fix lost offline edits",
		todos: ["Find where the edits are lost", "Write a failing test", "Merge per block, then verify"],
		active: ["Finding where the edits are lost", "Writing a failing test", "Fixing and running the tests"],
		found: [
			"## The cause",
			"",
			"- `mergeNote` lets the later writer **overwrite the whole note**",
			"- The block merge and hybrid clock were imported, never used",
			"",
			"```typescript",
			"if (remote.updatedAt > local.updatedAt) return remote;",
			"```",
			"",
			"| Scenario | Now | Block merge + HLC |",
			"| --- | --- | --- |",
			"| Different paragraphs edited | One side lost | Both kept |",
			"| Phone clock 3 min fast | Newer edit lost | Ordered by HLC |",
		].join("\n"),
	},
} as const;

function todos(lang: Lang, done: number) {
	const w = words[lang];
	return w.todos.map((content, index) => ({
		content,
		status: index < done ? "completed" : index === done ? "in_progress" : "pending",
		activeForm: w.active[index],
	}));
}

/** What the person types. The scripted model recognises the conversation by its opening words. */
export function heroAsk(lang: Lang): string {
	return words[lang].ask;
}

/** `hold`: the first reply waits for it — the conversation exists, nothing is running yet. */
export function heroScript(lang: Lang, options: { hold?: Promise<void> } = {}): Script {
	const w = words[lang];
	return {
		cue: w.ask.slice(0, 12),
		title: w.title,
		steps: [
			{
				hold: options.hold,
				delay: 500,
				tools: [{ name: "read", input: { path: "src/sync/merge.ts" } }],
			},
			{
				// A failing test first: the two scenarios that lose edits today. Then the plan, with the
				// two steps behind it already done — one plan update keeps the row of work short enough
				// for the split view's narrower column in English.
				delay: 400,
				tools: [
					{ name: "write", input: { path: "test/sync/merge.test.ts", content: MERGE_TEST } },
					{ name: "todo_write", input: { todos: todos(lang, 2) } },
				],
			},
			{
				text: w.found,
				delay: 400,
				rate: 140,
				tools: [
					{ name: "edit", input: { path: "src/sync/merge.ts", old_string: OLD_BODY, new_string: NEW_BODY } },
					{ name: "bash", input: { command: "npx vitest run test/sync" } },
				],
			},
		],
		finally: { text: lang === "zh" ? "测试全部通过。" : "All green." },
	};
}
