/**
 * The quieter conversations: they fill the sidebar, and a couple of them are opened beside the lead.
 *
 * Each is a single exchange about the project it sits under, written the way a developer and an
 * agent actually talk — short questions, answers with a little structure. Ages are relative to the
 * moment of capture, so the sidebar always reads as "this week's work".
 */

import type { FixtureSession } from "../lib/sessions.ts";
import type { World } from "../lib/world.ts";
import type { Lang } from "./types.ts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface Line {
	id: string;
	project: string;
	ago: number;
	title: Record<Lang, string>;
	ask: Record<Lang, string>;
	answer: Record<Lang, string>;
}

const LINES: Line[] = [
	{
		id: "5b1f0c62-8d7e-4a51-9c3a-2f6e1d0a7b11",
		project: "aurora-notes",
		ago: 2 * HOUR,
		title: { zh: "表格里用 Tab 切换单元格", en: "Tab through table cells" },
		ask: {
			zh: "在表格里按 Tab 能不能跳到下一个单元格？现在会插入两个空格。",
			en: "Can Tab move to the next table cell? Right now it inserts two spaces.",
		},
		answer: {
			zh: "可以。`applyShortcut` 现在对 Tab 一律走 `indent`，我在它前面加了一层判断：光标所在行以 `|` 开头时按单元格处理。\n\n- **Tab**：跳到下一个单元格，行尾时新起一行\n- **Shift + Tab**：回到上一个单元格\n- 其余情况保持原来的缩进行为\n\n补了 4 条测试，`npx vitest run test/editor` 全部通过。",
			en: "Yes. `applyShortcut` sends every Tab to `indent`; I added a check before it that treats a line starting with `|` as a table row.\n\n- **Tab** moves to the next cell, and starts a new row at the end\n- **Shift + Tab** moves back a cell\n- Everywhere else keeps the old indent behaviour\n\nAdded four tests; `npx vitest run test/editor` passes.",
		},
	},
	{
		id: "7c2d9e40-1a6b-4f83-b5d2-8e0f3c4a9d22",
		project: "aurora-notes",
		ago: 26 * HOUR,
		title: { zh: "排查首页加载慢", en: "Why is the home page slow?" },
		ask: {
			zh: "笔记多了以后首页要 2 秒才出来，帮我看看是哪里慢。",
			en: "With a lot of notes the home page takes two seconds to appear. Where is the time going?",
		},
		answer: {
			zh: "慢在列表查询：`db.notes.toArray()` 把全部笔记连正文一起读出来再排序。\n\n| 做法 | 2,000 篇笔记 |\n| --- | --- |\n| 全部读出再排序 | 1,840 ms |\n| 按 `updatedAt` 索引倒序取 50 条 | 38 ms |\n\n改成 `orderBy(\"updatedAt\").reverse().limit(50)`，正文等打开时再读。",
			en: "The list query: `db.notes.toArray()` reads every note, bodies included, then sorts.\n\n| Approach | 2,000 notes |\n| --- | --- |\n| Read all, sort in memory | 1,840 ms |\n| Newest 50 by the `updatedAt` index | 38 ms |\n\nSwitched to `orderBy(\"updatedAt\").reverse().limit(50)`; bodies load when a note opens.",
		},
	},
	{
		id: "9e4a1b73-2c5d-4e69-8f10-3b7c6d2e5a33",
		project: "aurora-notes",
		ago: 3 * DAY,
		title: { zh: "升级到 React 19", en: "Upgrade to React 19" },
		ask: { zh: "升级到 React 19，顺手把弃用的 API 清掉。", en: "Upgrade to React 19 and clear out the deprecated APIs." },
		answer: {
			zh: "升级完成，改动集中在三处：\n\n1. `ReactDOM.render` 换成 `createRoot`\n2. 去掉 `forwardRef`，`ref` 直接作为 prop 传入\n3. `useFormState` 改名为 `useActionState`\n\n类型检查和测试都已通过。",
			en: "Done. The changes fall in three places:\n\n1. `ReactDOM.render` → `createRoot`\n2. Dropped `forwardRef`; `ref` is now a plain prop\n3. `useFormState` renamed to `useActionState`\n\nType check and tests pass.",
		},
	},
	{
		id: "2f8b6c14-9d3e-4a7f-a1c5-6e2d8b0f4c44",
		project: "atlas-api",
		ago: 1.2 * HOUR,
		title: { zh: "给 /v2/search 加令牌桶限流", en: "Rate-limit /v2/search" },
		ask: {
			zh: "给 /v2/search 按 API key 加限流：每秒 10 个请求，允许突发 20 个。",
			en: "Rate-limit /v2/search per API key: 10 requests a second, bursts of 20.",
		},
		answer: {
			zh: "已接好。每个 API key 一个 `ratelimit.Bucket`，放在 `sync.Map` 里，超限返回 `429` 并带上 `Retry-After`。\n\n```go\nif !limiter.For(key).Allow(time.Now()) {\n\tw.Header().Set(\"Retry-After\", \"1\")\n\thttp.Error(w, \"rate limited\", http.StatusTooManyRequests)\n\treturn\n}\n```\n\n压测：单 key 每秒 50 个请求时稳定放行 10 个，其余全部 429。",
			en: "Wired up. One `ratelimit.Bucket` per API key in a `sync.Map`; over the limit returns `429` with `Retry-After`.\n\n```go\nif !limiter.For(key).Allow(time.Now()) {\n\tw.Header().Set(\"Retry-After\", \"1\")\n\thttp.Error(w, \"rate limited\", http.StatusTooManyRequests)\n\treturn\n}\n```\n\nUnder load — 50 requests a second on one key — exactly 10 get through each second, the rest get 429.",
		},
	},
	{
		id: "4d0e2a95-6b1c-4f38-9e27-1a5c7f3d6e55",
		project: "atlas-api",
		ago: 30 * HOUR,
		title: { zh: "生成 OpenAPI 文档", en: "Generate the OpenAPI spec" },
		ask: { zh: "根据 handler 生成 OpenAPI 文档，和现有客户端对一下字段。", en: "Generate an OpenAPI spec from the handlers and check it against the client." },
		answer: {
			zh: "生成了 `openapi.yaml`，和 `atlas-js` 客户端对比发现两处不一致：\n\n- `Hit.score` 客户端当成整数，实际是浮点\n- `limit` 上限客户端写的 50，服务端是 100\n\n已在客户端仓库开了 issue。",
			en: "Generated `openapi.yaml`. Against the `atlas-js` client there are two mismatches:\n\n- `Hit.score` is a float; the client treats it as an integer\n- The client caps `limit` at 50; the server allows 100\n\nFiled both on the client repo.",
		},
	},
	{
		id: "8a3c5e17-0f2d-4b96-8c41-9d6e2a1b7f66",
		project: "atlas-api",
		ago: 4 * DAY,
		title: { zh: "排查 Postgres 连接池耗尽", en: "Postgres pool exhaustion" },
		ask: { zh: "高峰期偶尔报 too many clients，帮我查查。", en: "At peak we sometimes get \"too many clients\". Can you dig in?" },
		answer: {
			zh: "是连接泄漏：`search.Index` 在出错分支里没有 `rows.Close()`。补上以后，高峰期连接数稳定在 18 左右，远低于上限 50。",
			en: "A leak: `search.Index` never calls `rows.Close()` on its error path. With that fixed, peak connections sit around 18, well under the limit of 50.",
		},
	},
	{
		id: "c61f7a28-3e4b-4d15-b9a0-5f8e1c2d3a77",
		project: "lumen-ui",
		ago: 5 * HOUR,
		title: { zh: "Button 暗色模式对比度不达标", en: "Button contrast in dark mode" },
		ask: { zh: "soft 按钮在暗色下对比度只有 3.1:1，调到 AA。", en: "The soft button is 3.1:1 in dark mode. Get it to AA." },
		answer: {
			zh: "把暗色下的文字色从强调色本身换成提亮 18% 的版本，底色不变：对比度 **4.8:1**，达到 AA。浅色主题不受影响。",
			en: "In dark mode the label now uses the accent lifted by 18% instead of the accent itself, same background: **4.8:1**, passing AA. Light mode is unchanged.",
		},
	},
	{
		id: "e7b20d39-5a6c-4e81-a3f2-0c9d4b8e1f88",
		project: "lumen-ui",
		ago: 2.2 * DAY,
		title: { zh: "给 Tooltip 补交互测试", en: "Interaction tests for Tooltip" },
		ask: { zh: "Tooltip 缺交互测试，补一下。", en: "Tooltip has no interaction tests. Add some." },
		answer: {
			zh: "补了 5 条：悬停出现、移开消失、键盘聚焦出现、Esc 关闭、`aria-describedby` 指向浮层。",
			en: "Five of them: shows on hover, hides on leave, shows on keyboard focus, closes on Esc, and `aria-describedby` points at the bubble.",
		},
	},
	{
		id: "0b9d4f5a-7c8e-4a23-9b61-2e3f5a6c8d99",
		project: "orbit-cli",
		ago: 6 * HOUR,
		title: { zh: "发布 v0.8.0 并整理更新日志", en: "Release v0.8.0" },
		ask: { zh: "准备发 0.8.0，把更新日志整理一下。", en: "Getting 0.8.0 out — tidy up the changelog." },
		answer: {
			zh: "更新日志整理好了，按「新功能 / 修复 / 破坏性变更」分组；`--json` 的输出格式单独写了一节迁移说明。版本号已改，等你确认后打 tag。",
			en: "Changelog grouped into features, fixes and breaking changes, with a migration note for the new `--json` output. Version bumped; I will tag once you have had a look.",
		},
	},
	{
		id: "3e5c8b6d-1f0a-4c72-8d94-7a1b2c3d4eaa",
		project: "orbit-cli",
		ago: 3.3 * DAY,
		title: { zh: "支持 --json 输出", en: "Add --json output" },
		ask: { zh: "给 orbit up 和 orbit ls 加 --json。", en: "Add --json to orbit up and orbit ls." },
		answer: {
			zh: "加好了，两个命令都输出一行一个 JSON 对象，方便 `jq` 处理；错误也以 JSON 输出，退出码不变。",
			en: "Done — both print one JSON object per line, easy to pipe into `jq`; errors come out as JSON too, with the same exit codes.",
		},
	},
];

/** The lead conversation's neighbour in the split view. */
export const SPLIT_PARTNER_ID = "2f8b6c14-9d3e-4a7f-a1c5-6e2d8b0f4c44";

export function sidebarSessions(world: World, lang: Lang, now = Date.now()): FixtureSession[] {
	return LINES.map((line) => ({
		id: line.id,
		project: world.project(line.project),
		title: line.title[lang],
		at: now - line.ago,
		modelId: "anthropic/claude-sonnet-5",
		messages: [
			{ role: "user", text: line.ask[lang] },
			{ role: "assistant", text: line.answer[lang] },
		],
	}));
}
