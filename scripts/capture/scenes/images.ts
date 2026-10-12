/**
 * `image-generation` — drawing in the conversation.
 *
 * In `aurora-notes`, an illustration for the empty notes page: the first picture drawn and done, then
 * two takes on its dark-mode twin being drawn from it, side by side — fields of dots at the picture's
 * shape, the stage they have reached, the percentage in the last one's corner. The conversation is the scripted Claude; the image model is
 * a Gemini image model behind an endpoint on this machine, which answers with the two pictures Lyra's
 * own drawing tests use (`packages/desktop/e2e/assets`).
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { drawAgainAsk, drawAgainScript, drawAsk, drawScript } from "../content/images.ts";
import { sidebarSessions } from "../content/sessions.ts";
import type { Lang } from "../content/types.ts";
import { finished, reached, startConversation } from "../lib/converse.ts";
import { LYRA, pause } from "../lib/env.ts";
import { scrollToBottom } from "../lib/frame.ts";
import { startImages } from "../lib/images.ts";
import { startModel } from "../lib/model.ts";
import { writeSessions } from "../lib/sessions.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { shootBoth } from "../lib/shoot.ts";
import { openLyra } from "../lib/window.ts";
import { buildWorld } from "../lib/world.ts";
import { REST } from "./hero.ts";

const IMAGE_MODEL = "gemini-3.1-flash-image";

/** The provider the image model is configured under, pointed at the endpoint on this machine. */
function imageProvider(port: number) {
	return {
		id: "google",
		name: "Google",
		api: "openai-chat-completions",
		baseUrl: `http://127.0.0.1:${port}/v1`,
		apiKey: "EXAMPLE-KEY-0000000000000000",
		enabled: true,
		models: [
			{
				id: `google/${IMAGE_MODEL}`,
				providerId: "google",
				modelId: IMAGE_MODEL,
				name: "Gemini 3.1 Flash Image",
				contextWindow: 65_536,
				maxOutputTokens: 32_768,
				supportsThinking: false,
				supportsImages: true,
				supportsTools: false,
				metadataSource: "manual",
			},
		],
	};
}

export async function imagesScene(lang: Lang): Promise<string[]> {
	const assets = join(LYRA, "packages", "desktop", "e2e", "assets");
	const [day, night] = await Promise.all([readFile(join(assets, "image-gen-day.jpg")), readFile(join(assets, "image-gen-night.jpg"))]);
	let finish = () => {};
	const held = new Promise<void>((resolve) => (finish = resolve));
	const images = await startImages({ generations: day, edits: night, drawMs: 2500, holdEdits: held });
	const world = await buildWorld(lang);
	const first = drawScript(lang);
	const second = drawAgainScript(lang);
	const model = await startModel([first, second]);
	const win = await openLyra({
		world,
		lang,
		seed: async (home) => {
			const settings = settingsFor({ world, lang, theme: "light", modelPort: model.port });
			settings.providers = [...(settings.providers as unknown[]), imageProvider(images.port)];
			settings.imageModelId = `google/${IMAGE_MODEL}`;
			await writeProfile(home, settings);
			await writeSessions(home, sidebarSessions(world, lang));
		},
	});
	try {
		await startConversation(win, "aurora-notes", drawAsk(lang));
		await finished(win, model, first);
		await win.until(`document.querySelector('[data-ly-image-frame="done"] img')?.complete === true`, 20_000, "第一张图画好");
		await pause(1200);
		await win.click("main textarea");
		await win.type(drawAgainAsk(lang));
		await pause(250);
		await win.key("Enter", "Enter", 13);
		await reached(model, second, 0);
		// About half way: past the first draft, setting the scene.
		await win.until(
			`Number.parseInt(document.querySelector('[data-ly-image-frame="drawing"] [data-ly-image-progress]')?.textContent ?? '0', 10) >= 48`,
			40_000,
			"第二张画到一半",
		);
		await scrollToBottom(win);
		await pause(400);
		return await shootBoth(win, "image-generation", REST);
	} catch (error) {
		console.log("   模型收到的：", model.log.map((entry) => entry.played).join(" → "));
		console.log("   生图接口收到的：", images.seen.join(" → ") || "（没有）");
		throw error;
	} finally {
		finish();
		await win.close().catch(() => {});
		await images.close().catch(() => {});
		await model.close().catch(() => {});
		await world.dispose().catch(() => {});
	}
}
