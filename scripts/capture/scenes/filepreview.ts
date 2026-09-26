/**
 * `file-preview` — a Markdown document open beside the conversation.
 *
 * The agent answers with a link to the project's design document; the link is clicked, and the
 * document opens in the panel beside the conversation, rendered: headings, a list, a quote, a table
 * and a sequence diagram drawn from its Mermaid block.
 */

import { docsAsk, docsScript } from "../content/docs.ts";
import { sidebarSessions } from "../content/sessions.ts";
import type { Lang } from "../content/types.ts";
import { finished, startConversation } from "../lib/converse.ts";
import { pause } from "../lib/env.ts";
import { dragSeparator } from "../lib/frame.ts";
import { startModel } from "../lib/model.ts";
import { writeSessions } from "../lib/sessions.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { shootBoth } from "../lib/shoot.ts";
import { openLyra } from "../lib/window.ts";
import { buildWorld } from "../lib/world.ts";
import { REST } from "./hero.ts";

export async function filePreviewScene(lang: Lang): Promise<string[]> {
	const world = await buildWorld(lang);
	const script = docsScript(lang);
	const model = await startModel([script]);
	const win = await openLyra({
		world,
		lang,
		seed: async (home) => {
			await writeProfile(home, settingsFor({ world, lang, theme: "light", modelPort: model.port }));
			await writeSessions(home, sidebarSessions(world, lang));
		},
	});
	try {
		await startConversation(win, "aurora-notes", docsAsk(lang));
		await finished(win, model, script);
		const link = await win.mark(`[...document.querySelectorAll('main a')].find((a) => a.textContent.includes('sync-design'))`);
		await win.click(link);
		await win.until(`document.querySelector('[data-dock-pane="file"] .prose-dw')`, 20_000, "预览面板");
		const width = await win.$<number>(`document.querySelector('[data-dock-pane="file"]').getBoundingClientRect().width`);
		await dragSeparator(win, `[data-dock-panes] [role=separator][aria-orientation=vertical]`, width - 600);
		// The sequence diagram is drawn after the text; wait for its figure.
		await win.until(`document.querySelector('[data-dock-pane="file"] .prose-dw svg text')`, 20_000, "时序图画完");
		await pause(1500);
		return await shootBoth(win, "file-preview", REST);
	} catch (error) {
		console.log("   模型收到的：", model.log.map((entry) => entry.played).join(" → "));
		throw error;
	} finally {
		await win.close().catch(() => {});
		await model.close().catch(() => {});
		await world.dispose().catch(() => {});
	}
}
