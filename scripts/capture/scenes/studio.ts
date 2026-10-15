/**
 * `studio` — the Studio: what was drawn this week, and one picture opened with its history.
 *
 * The album first: today, yesterday, three days ago, every picture at its own shape — the boat
 * pictures and the sign-in pair marked with the size of their family. Then the winter night opened:
 * the picture large on the left; on the right the conversation it came from, its history (morning →
 * night → winter in the accent, the dusk branch listed after), the prompt and the facts. The pictures
 * are real (`art/generate.ts`); the conversations around them are seeded (`lib/drawings.ts`).
 */

import { drawingSessions } from "../content/studio.ts";
import { sidebarSessions } from "../content/sessions.ts";
import type { Lang } from "../content/types.ts";
import { loadArt, mediaSettings, writeMedia } from "../lib/drawings.ts";
import { pause } from "../lib/env.ts";
import { writeSessions } from "../lib/sessions.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { shootBoth } from "../lib/shoot.ts";
import { openLyra } from "../lib/window.ts";
import { buildWorld } from "../lib/world.ts";
import { REST } from "./hero.ts";

/** Every tile in view has drawn its picture. */
const TILES_DRAWN = `[...document.querySelectorAll('[data-ly-gallery-tile]')].filter((tile) => tile.getBoundingClientRect().top < innerHeight).every((tile) => tile.querySelector('[data-loaded]'))`;

export async function studioScene(lang: Lang): Promise<string[]> {
	const art = await loadArt();
	const world = await buildWorld(lang);
	const drawn = drawingSessions(world, lang, art);
	const win = await openLyra({
		world,
		lang,
		seed: async (home) => {
			await writeProfile(home, mediaSettings(settingsFor({ world, lang, theme: "light" })));
			await writeSessions(home, [...sidebarSessions(world, lang), ...drawn]);
			await writeMedia(home, art);
		},
	});
	try {
		await win.click('[data-ly-rail-item="gallery"]');
		await win.until(`document.querySelectorAll('[data-ly-gallery-tile]').length === 8`, 20_000, "创作里的八张图");
		await win.until(TILES_DRAWN, 20_000, "看得见的作品都画出来了");
		await pause(1200);
		const album = await shootBoth(win, "studio", REST);

		await win.click(`[data-ly-gallery-tile="${art["boat-winter"].media}"]`);
		await win.until(`document.querySelector('[data-ly-gallery-detail="${art["boat-winter"].media}"]')`, 10_000, "冬夜那张打开了");
		await win.until(
			`[...document.querySelectorAll('[data-ly-gallery-detail] img')].every((img) => img.complete && img.naturalWidth > 0)`,
			20_000,
			"大图和链路里的缩略图都画出来了",
		);
		await pause(1500);
		const detail = await shootBoth(win, "studio-detail", REST);
		return [...album, ...detail];
	} finally {
		await win.close().catch(() => {});
		await world.dispose().catch(() => {});
	}
}
