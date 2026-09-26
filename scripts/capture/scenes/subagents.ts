/**
 * `sub-agents` — several sub-agents running at once.
 *
 * The lead agent has sent four release checks out in parallel; three run, one waits. The transcript
 * shows the dispatch opened into its four cards, each with the agent's face; above the composer the
 * bar counts who is running and who is queued; the panel on the right follows the reviewer as it
 * reads and searches its way through the sync module.
 */

import { FIXED_MERGE, MERGE_TEST } from "../content/hero.ts";
import { sidebarSessions } from "../content/sessions.ts";
import { releaseAsk, releaseScript, releaseTasks, subAgentRoute } from "../content/subagents.ts";
import type { Lang } from "../content/types.ts";
import { reached, startConversation } from "../lib/converse.ts";
import { pause } from "../lib/env.ts";
import { dragSeparator, expand } from "../lib/frame.ts";
import { startModel } from "../lib/model.ts";
import { writeSessions } from "../lib/sessions.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { shootBoth } from "../lib/shoot.ts";
import { openLyra } from "../lib/window.ts";
import { buildWorld, commitOnBranch, holdVitest } from "../lib/world.ts";
import { REST } from "./hero.ts";

export async function subAgentsScene(lang: Lang): Promise<string[]> {
	const world = await buildWorld(lang);
	const aurora = world.project("aurora-notes");
	await commitOnBranch(world, aurora, "release/0.15", "fix(sync): merge per block, ordered by hybrid clock", {
		"src/sync/merge.ts": FIXED_MERGE,
		"test/sync/merge.test.ts": MERGE_TEST,
	});
	const script = releaseScript(lang);
	const model = await startModel([script], subAgentRoute(lang));
	const win = await openLyra({
		world,
		lang,
		seed: async (home) => {
			await writeProfile(home, settingsFor({ world, lang, theme: "light", modelPort: model.port, extra: { subAgentDelegation: "eager", maxConcurrentSubAgents: 3 } }));
			await writeSessions(home, sidebarSessions(world, lang));
		},
	});
	const release = await holdVitest(world);
	try {
		await startConversation(win, "aurora-notes", releaseAsk(lang));
		await reached(model, script, 0);
		await win.until(`document.querySelector('[data-ly-subagent-bar]')`, 30_000, "子智能体状态条");
		// Let the reviewer get a few steps in, so its panel has something to show.
		const reviewPrompt = releaseTasks(lang)[2].prompt;
		const deadline = Date.now() + 40_000;
		while (model.log.filter((entry) => entry.played === "route" && (entry.heard.said[0] ?? "").includes(reviewPrompt)).length < 4) {
			if (Date.now() > deadline) throw new Error("审查子智能体没走到第四步");
			await pause(250);
		}
		await pause(1500);
		// The dispatch, opened into its cards.
		await expand(win, `[...document.querySelectorAll('main [data-ly-run] > button.ly-flow-row')].find((b) => b.closest('[data-ly-run]').querySelector('[data-ly-avatar-host]') || /4/.test(b.innerText))`);
		await pause(900);
		// The reviewer in the panel: its card opens it there.
		const reviewTitle = releaseTasks(lang)[2].description;
		const card = await win.mark(`[...document.querySelectorAll('main [data-ly-run] button')].find((b) => !b.classList.contains('ly-flow-row') && b.innerText.includes(${JSON.stringify(reviewTitle)}))`);
		await win.click(card);
		await win.until(`(document.querySelector('[data-dock-pane="subagents"]')?.innerText ?? '').includes(${JSON.stringify(reviewTitle)})`, 10_000, "面板换到审查子智能体");
		await pause(800);
		const width = await win.$<number>(`document.querySelector('[data-dock-pane="subagents"]').getBoundingClientRect().width`);
		await dragSeparator(win, `[data-dock-panes] [role=separator][aria-orientation=vertical]`, width - 470);
		await pause(900);
		return await shootBoth(win, "sub-agents", REST);
	} catch (error) {
		console.log("   模型收到的：", model.log.map((entry) => entry.played).join(" → "));
		console.log("   窗口上：", await win.describe());
		throw error;
	} finally {
		await release().catch(() => {});
		await win.close().catch(() => {});
		await model.close().catch(() => {});
		await world.dispose().catch(() => {});
	}
}
