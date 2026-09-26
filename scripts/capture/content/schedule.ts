/**
 * Scheduled tasks on the made-up machine, and the conversations their last runs left behind.
 *
 * Times are wall-clock times in the app's zone (see `afternoonZone`): the daily tasks that are due
 * before now have already run today, the interval ones ran a little while ago — the scheduler checks
 * a few seconds after launch, and a task that looks due would really be started.
 */

import type { FixtureSession } from "../lib/sessions.ts";
import { localMoment, PERSON, type World } from "../lib/world.ts";
import type { Lang } from "./types.ts";

interface Task {
	id: string;
	project: string;
	name: Record<Lang, string>;
	prompt: Record<Lang, string>;
	schedule: { kind: "daily"; time: string } | { kind: "interval"; minutes: number };
	enabled: boolean;
	/** When it last ran: a daily time today, or minutes ago. */
	last?: { today: string } | { minutesAgo: number } | { daysAgo: number; at: string };
	/** What its last run reported, when it left a conversation behind. */
	report?: Record<Lang, string>;
}

const TASKS: Task[] = [
	{
		id: "dependency-audit",
		project: "aurora-notes",
		name: { zh: "依赖安全巡检", en: "Dependency audit" },
		prompt: {
			zh: "检查 npm 依赖的安全公告；有高危漏洞就升级、跑测试，把改动整理成一个 PR。",
			en: "Check the npm dependencies for security advisories. If anything is high severity, upgrade it, run the tests and open a PR.",
		},
		schedule: { kind: "daily", time: "09:00" },
		enabled: true,
		last: { today: "09:00" },
		report: {
			zh: "巡检完成：没有高危漏洞。`vite` 有一个中危公告，只影响开发服务器，已记在 `SECURITY.md` 的待办里。",
			en: "Audit done: nothing high severity. `vite` has a moderate advisory that only affects the dev server; noted in `SECURITY.md`.",
		},
	},
	{
		id: "issue-digest",
		project: "atlas-api",
		name: { zh: "整理新 issue", en: "Triage new issues" },
		prompt: {
			zh: "汇总过去 24 小时新开的 issue，按优先级分组，标出需要我拍板的。",
			en: "Summarise the issues opened in the last 24 hours, grouped by priority, and flag the ones that need my call.",
		},
		schedule: { kind: "daily", time: "10:30" },
		enabled: true,
		last: { today: "10:30" },
		report: {
			zh: "新开 6 个 issue：高优先级 1 个（`/v2/search` 分页偶尔重复），中 3 个，低 2 个。需要你拍板的是 #418：是否把 `limit` 上限提到 200。",
			en: "Six new issues: one high (duplicate results when paging `/v2/search`), three medium, two low. #418 needs your call: raise the `limit` cap to 200?",
		},
	},
	{
		id: "ci-watch",
		project: "lumen-ui",
		name: { zh: "盯一下 CI", en: "Keep an eye on CI" },
		prompt: {
			zh: "看 main 分支最近一次 CI；失败的话找出原因，给出修复建议。",
			en: "Check the latest CI run on main. If it failed, find out why and suggest a fix.",
		},
		schedule: { kind: "interval", minutes: 120 },
		enabled: true,
		last: { minutesAgo: 38 },
		report: {
			zh: "main 上最近一次 CI 全部通过（2 分 41 秒），视觉回归没有新差异。",
			en: "The latest CI run on main passed (2 min 41 s); no new visual-regression diffs.",
		},
	},
	{
		id: "weekly-notes",
		project: "orbit-cli",
		name: { zh: "周报草稿", en: "Weekly notes draft" },
		prompt: {
			zh: "根据本周合并的 PR 起草周报：做了什么、下周计划、有什么风险。",
			en: "Draft this week's notes from the merged PRs: what shipped, what is next, what is at risk.",
		},
		schedule: { kind: "daily", time: "17:30" },
		enabled: true,
		last: { daysAgo: 1, at: "17:30" },
	},
	{
		id: "preview-cleanup",
		project: "orbit-cli",
		name: { zh: "清理过期预览环境", en: "Clean up stale previews" },
		prompt: {
			zh: "列出 7 天没有更新的预览环境，确认没人在用后清理掉。",
			en: "List preview environments not updated in 7 days and tear down the ones nobody is using.",
		},
		schedule: { kind: "interval", minutes: 360 },
		enabled: false,
		last: { daysAgo: 3, at: "15:10" },
	},
];

function lastRun(world: World, task: Task): number | undefined {
	if (!task.last) return undefined;
	if ("today" in task.last) return localMoment(world, task.last.today);
	if ("minutesAgo" in task.last) return Date.now() - task.last.minutesAgo * 60_000;
	return localMoment(world, task.last.at, task.last.daysAgo);
}

const sessionIdFor = (task: Task) => `5c4ed01e-0000-4000-8000-${task.id.replace(/[^a-z]/g, "").padEnd(12, "0").slice(0, 12)}`;

/**
 * The `scheduledTasks` array for settings.json.
 *
 * The Scheduled page prints each task's working directory in full, and the made-up home really lives
 * in a temporary directory whose path says so. So the tasks name the story's own path instead —
 * `/Users/mayachen/Projects/…`, the path the project's tools print too. Nothing runs them during the
 * shot: every one is either not due or switched off.
 */
export function scheduledTasks(world: World, lang: Lang) {
	return TASKS.map((task) => {
		const at = lastRun(world, task);
		return {
			id: task.id,
			name: task.name[lang],
			cwd: `/Users/${PERSON.login}/Projects/${world.project(task.project).name}`,
			prompt: task.prompt[lang],
			schedule: task.schedule,
			enabled: task.enabled,
			...(at ? { lastRunAt: at } : {}),
			...(task.report ? { lastSessionId: sessionIdFor(task) } : {}),
		};
	});
}

/** The conversations the last runs produced — the same kind of session any other run leaves. */
export function scheduledRunSessions(world: World, lang: Lang): FixtureSession[] {
	return TASKS.filter((task) => task.report).map((task) => ({
		id: sessionIdFor(task),
		project: world.project(task.project),
		title: task.name[lang],
		at: (lastRun(world, task) ?? Date.now()) + 90_000,
		modelId: "anthropic/claude-sonnet-5",
		messages: [
			{ role: "user", text: task.prompt[lang] },
			{ role: "assistant", text: task.report?.[lang] ?? "" },
		],
	}));
}
