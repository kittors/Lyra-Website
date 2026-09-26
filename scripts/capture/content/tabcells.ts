/**
 * A finished conversation in `aurora-notes`: Tab moves between table cells in the editor.
 *
 * It runs for real before the split-view shot — a read, two edits, a new test file, a test run — so
 * the pane beside the lead conversation shows a turn that is done: the collapsed record of the work,
 * the answer with a list and a code block, and the card listing what changed.
 */

import type { Script } from "../lib/model.ts";
import { AURORA_SHORTCUTS } from "./projects.ts";
import type { Lang } from "./types.ts";

const TAB_BEFORE = `  if (event.key === "Tab") return indent(text, start, end, event.shiftKey ? -1 : 1);`;
const TAB_AFTER = `  if (event.key === "Tab" && inTable(text, start)) {
    return moveCell(text, start, event.shiftKey ? -1 : 1);
  }
  if (event.key === "Tab") return indent(text, start, end, event.shiftKey ? -1 : 1);`;

const WRAP_END = `  return { text: text.slice(0, start) + mark + inner + mark + text.slice(end), cursor: end + mark.length * 2 };
}`;
const HELPERS = `${WRAP_END}

/** A table row is a line that starts with a pipe. */
function inTable(text: string, at: number): boolean {
  const lineStart = text.lastIndexOf("\\n", at - 1) + 1;
  return text.startsWith("|", lineStart);
}

/** Move to the next or previous cell; past the last cell, start a new row. */
function moveCell(text: string, at: number, direction: 1 | -1): Edit {
  const pipes = [...text.matchAll(/\\|/g)].map((match) => match.index);
  const next = direction > 0 ? pipes.find((index) => index >= at) : pipes.findLast((index) => index < at - 1);
  if (next === undefined) {
    const lineEnd = text.indexOf("\\n", at);
    const end = lineEnd === -1 ? text.length : lineEnd;
    return { text: \`\${text.slice(0, end)}\\n|  |\${text.slice(end)}\`, cursor: end + 3 };
  }
  return { text, cursor: next + 2 };
}`;

if (!AURORA_SHORTCUTS.includes(TAB_BEFORE) || !AURORA_SHORTCUTS.includes(WRAP_END)) {
	throw new Error("tab-cells script is out of step with src/editor/shortcuts.ts");
}

const TEST = `import { describe, expect, it } from "vitest";
import { applyShortcut } from "../../src/editor/shortcuts";

const tab = { key: "Tab", shiftKey: false, metaKey: false };
const back = { ...tab, shiftKey: true };
const table = "| a | b |\\n| - | - |\\n| 1 | 2 |";

describe("Tab in tables", () => {
  it("moves to the next cell", () => {
    expect(applyShortcut(tab, table, 2, 2)?.cursor).toBe(6);
  });

  it("moves back with Shift+Tab", () => {
    expect(applyShortcut(back, table, 6, 6)?.cursor).toBe(2);
  });

  it("starts a new row after the last cell", () => {
    expect(applyShortcut(tab, table, table.length, table.length)?.text.endsWith("|  |")).toBe(true);
  });

  it("still indents outside a table", () => {
    expect(applyShortcut(tab, "- item", 0, 0)?.text).toBe("  - item");
  });
});
`;

const words = {
	zh: {
		ask: "在表格里按 Tab 能不能跳到下一个单元格？现在会插入两个空格。",
		title: "表格里用 Tab 切换单元格",
		done: [
			"可以了。表格行里的 Tab 现在按单元格移动：",
			"",
			"- **Tab**：跳到下一个单元格，最后一格时新起一行",
			"- **Shift + Tab**：回到上一个单元格",
			"- 表格之外，照旧缩进",
			"",
			"```typescript",
			"if (event.key === \"Tab\" && inTable(text, start)) {",
			"  return moveCell(text, start, event.shiftKey ? -1 : 1);",
			"}",
			"```",
			"",
			"补了 4 条测试，`test/editor` 下 9 条全部通过。",
		].join("\n"),
	},
	en: {
		ask: "Can Tab move to the next table cell? Right now it inserts two spaces.",
		title: "Tab through table cells",
		done: [
			"Done. Inside a table row, Tab now moves by cell:",
			"",
			"- **Tab** goes to the next cell, and starts a new row after the last one",
			"- **Shift + Tab** goes back a cell",
			"- Outside tables, it indents as before",
			"",
			"```typescript",
			"if (event.key === \"Tab\" && inTable(text, start)) {",
			"  return moveCell(text, start, event.shiftKey ? -1 : 1);",
			"}",
			"```",
			"",
			"Added four tests; all 9 in `test/editor` pass.",
		].join("\n"),
	},
} as const;

export function tabCellsAsk(lang: Lang): string {
	return words[lang].ask;
}

export function tabCellsScript(lang: Lang): Script {
	const w = words[lang];
	return {
		cue: w.ask.slice(0, 14),
		title: w.title,
		steps: [
			{ delay: 300, tools: [{ name: "read", input: { path: "src/editor/shortcuts.ts" } }] },
			{
				delay: 300,
				tools: [
					{ name: "edit", input: { path: "src/editor/shortcuts.ts", old_string: TAB_BEFORE, new_string: TAB_AFTER } },
					{ name: "edit", input: { path: "src/editor/shortcuts.ts", old_string: WRAP_END, new_string: HELPERS } },
					{ name: "write", input: { path: "test/editor/shortcuts.test.ts", content: TEST } },
				],
			},
			{ delay: 300, tools: [{ name: "bash", input: { command: "npx vitest run test/editor" } }] },
			{ text: w.done, delay: 300, rate: 45 },
		],
	};
}
