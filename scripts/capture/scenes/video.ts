/**
 * `video-generation` — a video being made in the conversation.
 *
 * The empty-notes conversation from the Studio shots: the dusk picture at its end, then the ask to make
 * it a six-second clip, and the clip on its way — the dusk picture's shape held by a field of dots,
 * the stage and how long it has been waiting above it, the percentage in its corner. The video model
 * is xAI's, behind an endpoint on this machine that keeps saying "pending" (`lib/videos.ts`); the
 * conversation before it is seeded (`lib/drawings.ts`), the request is made live.
 */

import { BOAT_SESSION, drawingSessions } from "../content/studio.ts";
import { sidebarSessions } from "../content/sessions.ts";
import type { Lang } from "../content/types.ts";
import { filmAsk, filmScript } from "../content/video.ts";
import { reached } from "../lib/converse.ts";
import { loadArt, mediaSettings, writeMedia } from "../lib/drawings.ts";
import { pause } from "../lib/env.ts";
import { scrollToBottom } from "../lib/frame.ts";
import { startModel } from "../lib/model.ts";
import { writeSessions } from "../lib/sessions.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { shootBoth } from "../lib/shoot.ts";
import { startVideos } from "../lib/videos.ts";
import { openLyra } from "../lib/window.ts";
import { buildWorld } from "../lib/world.ts";
import { REST } from "./hero.ts";

/** How long the clip has been waiting when it is shot: long enough to read as a video model at work. */
const WAITED_MS = 72_000;

export async function videoScene(lang: Lang): Promise<string[]> {
	const art = await loadArt();
	const world = await buildWorld(lang);
	const script = filmScript(lang);
	const model = await startModel([script]);
	const videos = await startVideos();
	const win = await openLyra({
		world,
		lang,
		seed: async (home) => {
			await writeProfile(home, mediaSettings(settingsFor({ world, lang, theme: "light", modelPort: model.port }), `http://127.0.0.1:${videos.port}/v1`));
			await writeSessions(home, [...sidebarSessions(world, lang), ...drawingSessions(world, lang, art)]);
			await writeMedia(home, art);
		},
	});
	try {
		await win.click(`[data-ly-row="${BOAT_SESSION}"] button`);
		await win.until(`[...document.querySelectorAll('main img')].length >= 4 && [...document.querySelectorAll('main img')].every((img) => img.complete && img.naturalWidth > 0)`, 20_000, "对话里的四张图");
		await pause(800);
		await win.click("main textarea");
		await win.type(filmAsk(lang));
		await pause(250);
		await win.key("Enter", "Enter", 13);
		await reached(model, script, 0);
		await win.until(`[...document.querySelectorAll('[data-ly-video-card="making"]')].some((card) => card.checkVisibility())`, 30_000, "视频卡片开始做");
		const asked = Date.now();
		while (!videos.seen.some((line) => line.startsWith("POST"))) {
			if (Date.now() - asked > 30_000) throw new Error("视频接口没收到提交");
			await pause(300);
		}
		await pause(WAITED_MS);
		await scrollToBottom(win);
		await pause(800);
		return await shootBoth(win, "video-generation", REST);
	} catch (error) {
		console.log("   模型收到的：", model.log.map((entry) => entry.played).join(" → "));
		console.log("   视频接口收到的：", videos.seen.join(" → ") || "（没有）");
		console.log("   视频卡片：", await win.$<string>(`[...document.querySelectorAll('[data-ly-video-card]')].map((card) => card.getAttribute('data-ly-video-card') + ': ' + card.innerText.replace(/\\s+/g, ' ') + ' ' + [...card.querySelectorAll('[data-ly-tip]')].map((el) => el.getAttribute('data-ly-tip')).join(' ')).join(' | ')`).catch(() => "（读不到）"));
		throw error;
	} finally {
		await win.close().catch(() => {});
		await videos.close().catch(() => {});
		await model.close().catch(() => {});
		await world.dispose().catch(() => {});
	}
}
