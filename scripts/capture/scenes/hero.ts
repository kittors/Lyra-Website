/**
 * `hero-conversation` — the main window with the agent mid-task.
 *
 * The sidebar holds four projects and their recent conversations. The conversation is the agent
 * fixing the sync bug in `aurora-notes`: the question, the files it read, the cause written up with
 * a heading, a code block and a table, then the edit, the new test and the test run it is waiting
 * on — that group opened so each call shows as a card, the plan among them. The Git panel beside it
 * shows the change as a diff.
 */

import { heroAsk, heroScript } from "../content/hero.ts";
import { sidebarSessions } from "../content/sessions.ts";
import type { Lang } from "../content/types.ts";
import { pause } from "../lib/env.ts";
import { dragSeparator, expand, scrollTo, scrollToBottom, transcriptBox } from "../lib/frame.ts";
import { startModel, type Script, type ScriptedModel } from "../lib/model.ts";
import { writeSessions } from "../lib/sessions.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { shootBoth } from "../lib/shoot.ts";
import { openLyra, type LyraWindow, type Point } from "../lib/window.ts";
import { buildWorld, holdVitest, type World } from "../lib/world.ts";

export interface HeroRun {
	world: World;
	model: ScriptedModel;
	win: LyraWindow;
	release: () => Promise<void>;
	dispose(): Promise<void>;
}

/** A point nothing reacts to: the empty strip at the top of the sidebar, right of its toggle. */
export const REST: Point = { x: 220, y: 16 };

/** Start the app on the made-up machine and play the lead conversation up to the running test. */
export async function playHero(lang: Lang, extraScripts: Script[] = [], extraSettings: Record<string, unknown> = {}): Promise<HeroRun> {
	const world = await buildWorld(lang);
	const model = await startModel([heroScript(lang), ...extraScripts]);
	const win = await openLyra({
		world,
		lang,
		seed: async (home) => {
			await writeProfile(home, settingsFor({ world, lang, theme: "light", modelPort: model.port, extra: extraSettings }));
			await writeSessions(home, sidebarSessions(world, lang));
		},
	});
	const release = await holdVitest(world);
	const dispose = async () => {
		await release().catch(() => {});
		await win.close().catch(() => {});
		await model.close().catch(() => {});
		await world.dispose().catch(() => {});
	};
	try {
		await win.until(`document.querySelector("main textarea")`, 20_000);
		await win.click("main textarea");
		await win.type(heroAsk(lang));
		await pause(300);
		await win.key("Enter", "Enter", 13);
		// The test run is the last step: wait until the model has asked for it and its row is running.
		const last = `#${heroScript(lang).steps.length - 1}`;
		const deadline = Date.now() + 90_000;
		while (!model.log.some((entry) => entry.played.endsWith(last))) {
			if (Date.now() > deadline) throw new Error("模型没走到跑测试那一步");
			await pause(200);
		}
		await testRunning(win);
		return { world, model, win, release, dispose };
	} catch (error) {
		console.log("   模型收到的：", model.log.map((entry) => entry.played).join(" → "));
		console.log("   窗口上：", await win.describe());
		await dispose();
		throw error;
	}
}

/**
 * Wait until the last stretch of work — the fix and the test run — is on screen and running.
 *
 * Not merely "a stretch of tool work is running": the model is asked for its last step while the
 * previous stretch still reads as running, and that step streams its analysis before its tool calls
 * arrive. The lead conversation has two stretches; the second one, running, is the one to wait for.
 */
export async function testRunning(win: LyraWindow, scope = ""): Promise<void> {
	await win.until(
		`(() => { const runs = [...document.querySelectorAll(${JSON.stringify(`${scope} [data-ly-run]`.trim())})]; return runs.length >= 2 && runs[runs.length - 1].getAttribute('data-ly-run') === 'running'; })()`,
		30_000,
		"测试命令开始运行",
	);
	await pause(1500);
}

/** The Git panel beside the conversation, wide enough to read a diff, with the fix opened in it. */
export async function openGitDiff(win: LyraWindow, width = 480): Promise<void> {
	await win.click(`button[aria-label^="Git"]`);
	await win.until(`document.querySelector('[data-dock-pane="review"]')?.innerText.includes('merge.ts')`, 20_000, "Git 面板列出改动");
	await pause(600);
	const current = await win.$<number>(`document.querySelector('[data-dock-pane="review"]').getBoundingClientRect().width`);
	await dragSeparator(win, `[data-dock-panes] [role=separator][aria-orientation=vertical]`, current - width);
	const row = await win.mark(
		`[...document.querySelectorAll('[data-dock-pane="review"] button, [data-dock-pane="review"] [role=treeitem], [data-dock-pane="review"] [role=button]')].find((el) => /src\\/sync\\/merge\\.ts/.test(el.textContent || '') && el.checkVisibility())`,
	);
	await win.click(row);
	await pause(900);
	const test = await win.mark(
		`[...document.querySelectorAll('[data-dock-pane="review"] button, [data-dock-pane="review"] [role=treeitem], [data-dock-pane="review"] [role=button]')].find((el) => /test\\/sync\\/merge\\.test\\.ts/.test(el.textContent || '') && el.checkVisibility())`,
	);
	await win.click(test);
	await pause(1200);
}

/**
 * Frame the lead conversation: the whole turn, with nothing under the transcript's edge fades.
 *
 * The transcript softens its edges while there is more to scroll that way — 36px at the top, 48px
 * at the bottom — and a line inside the bottom one reads as faded. So the transcript goes all the
 * way down (no bottom fade: the running line is crisp), and the question has to sit below the top
 * fade. Returns the room to spare above the question's bubble; negative means the turn is too tall,
 * in which case the question is kept clear and the bottom is what gives.
 */
export async function fitTurn(win: LyraWindow, askStart: string, pane = '[data-dock-pane="conversation"]'): Promise<number> {
	const question = await win.mark(
		`[...document.querySelectorAll(${JSON.stringify(`${pane} *`)})].find((el) => el.childElementCount === 0 && (el.textContent || '').startsWith(${JSON.stringify(askStart)}))`,
		"data-shot-question",
	);
	await scrollToBottom(win, pane);
	const box = await transcriptBox(win, pane);
	if (box.scrollHeight <= box.clientHeight + 1) return Number.POSITIVE_INFINITY;
	// The bubble is about 10px taller than its text on top; it must clear the 36px fade.
	const text = await win.$<number>(`document.querySelector('${question}').getBoundingClientRect().top`);
	const slack = text - 10 - (box.top + 36);
	if (slack < 0) await scrollTo(win, question, box.top + 46, { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 }, pane);
	return slack;
}

export async function heroScene(lang: Lang): Promise<string[]> {
	const run = await playHero(lang);
	const { win } = run;
	try {
		await openGitDiff(win);
		await expand(win, `document.querySelector('[data-ly-run="running"] > button.ly-flow-row')`);
		await pause(800);
		const slack = await fitTurn(win, heroAsk(lang).slice(0, 10));
		console.log(`   画面余量：${Math.round(slack)}px`);
		return await shootBoth(win, "hero-conversation", REST);
	} finally {
		await run.dispose();
	}
}
