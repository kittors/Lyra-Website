/**
 * `schedule` — the Scheduled page: recurring tasks across the four projects.
 *
 * Daily and interval tasks, one of them switched off, each with when it last ran and when it runs
 * next; the ones that have run link to the conversation their last run left behind.
 */

import { scheduledRunSessions, scheduledTasks } from "../content/schedule.ts";
import { sidebarSessions } from "../content/sessions.ts";
import type { Lang } from "../content/types.ts";
import { pause } from "../lib/env.ts";
import { writeSessions } from "../lib/sessions.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { shootBoth } from "../lib/shoot.ts";
import { openLyra } from "../lib/window.ts";
import { buildWorld } from "../lib/world.ts";
import { REST } from "./hero.ts";

export async function scheduleScene(lang: Lang): Promise<string[]> {
	const world = await buildWorld(lang);
	const win = await openLyra({
		world,
		lang,
		seed: async (home) => {
			await writeProfile(home, settingsFor({ world, lang, theme: "light", extra: { scheduledTasks: scheduledTasks(world, lang) } }));
			await writeSessions(home, [...sidebarSessions(world, lang), ...scheduledRunSessions(world, lang)]);
		},
	});
	try {
		await win.clickText(lang === "zh" ? "已安排" : "Scheduled");
		// Names are editable fields, so they are in values, not in the text.
		await win.until(`[...document.querySelectorAll('input, textarea')].some((field) => field.value.includes(${JSON.stringify(lang === "zh" ? "依赖安全巡检" : "Dependency audit")}))`, 20_000, "任务出现");
		await pause(1500);
		return await shootBoth(win, "schedule", REST);
	} finally {
		await win.close().catch(() => {});
		await world.dispose().catch(() => {});
	}
}
