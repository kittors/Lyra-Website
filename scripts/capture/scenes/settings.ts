/**
 * `settings-models` — model providers in Settings.
 *
 * Five providers a developer might really have: Anthropic and OpenAI directly, OpenRouter for
 * everything else, DeepSeek and Moonshot through their Anthropic-compatible endpoints — between
 * them two of the three API formats Lyra speaks (Responses and Anthropic Messages; Chat Completions
 * is the third). OpenRouter is the one open, so its model list shows five vendors' marks.
 * Keys are placeholders, and the page shows them as dots.
 */

import { sidebarSessions } from "../content/sessions.ts";
import type { Lang } from "../content/types.ts";
import { pause } from "../lib/env.ts";
import { writeSessions } from "../lib/sessions.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { shootBoth } from "../lib/shoot.ts";
import { openLyra } from "../lib/window.ts";
import { buildWorld } from "../lib/world.ts";
import { REST } from "./hero.ts";

export async function settingsScene(lang: Lang): Promise<string[]> {
	const world = await buildWorld(lang);
	const win = await openLyra({
		world,
		lang,
		seed: async (home) => {
			await writeProfile(home, settingsFor({ world, lang, theme: "light", providerSet: "all" }));
			await writeSessions(home, sidebarSessions(world, lang));
		},
	});
	try {
		// Settings is the gear at the bottom of the window's icon rail.
		await win.click('[data-ly-rail-item="settings"]');
		await win.until(`document.body.innerText.includes('OpenRouter')`, 15_000, "设置页的供应商列表");
		await pause(800);
		// A row is the provider's initial on a tinted square, then its name — so the name is the row's last line.
		const row = await win.mark(`[...document.querySelectorAll('[data-ly-provider-panes] button')].find((el) => el.checkVisibility() && el.innerText.trim().split('\\n').at(-1).trim() === 'OpenRouter')`);
		await win.click(row);
		await win.until(`[...document.querySelectorAll('input')].some((field) => field.value.includes('openrouter.ai'))`, 10_000, "OpenRouter 的详情");
		await pause(1200);
		return await shootBoth(win, "settings-models", REST);
	} finally {
		await win.close().catch(() => {});
		await world.dispose().catch(() => {});
	}
}
