/**
 * `split-view` — two conversations side by side.
 *
 * Left, the lead conversation still at work; right, a finished one from earlier in the same
 * project, with its answer and the card of files it changed. Both in `aurora-notes` on purpose:
 * the composer's project row follows the focused conversation rather than its own pane, so two
 * projects side by side would show one pane with the other's project name.
 *
 * The finished conversation is dragged in from the sidebar with the real pointer, the way a person
 * opens a split, next to a fresh conversation in which the lead one is then started.
 */

import { heroAsk, heroScript } from "../content/hero.ts";
import { sidebarSessions } from "../content/sessions.ts";
import { tabCellsAsk, tabCellsScript } from "../content/tabcells.ts";
import type { Lang } from "../content/types.ts";
import { finished, reached, startConversation } from "../lib/converse.ts";
import { pause } from "../lib/env.ts";
import { startModel } from "../lib/model.ts";
import { writeSessions } from "../lib/sessions.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { shootBoth } from "../lib/shoot.ts";
import { openLyra, type LyraWindow } from "../lib/window.ts";
import { buildWorld, holdVitest } from "../lib/world.ts";
import { expand } from "../lib/frame.ts";
import { fitTurn, REST, testRunning } from "./hero.ts";

/** The hand-written conversation this scene plays live instead. */
const TAB_CELLS_FIXTURE = "5b1f0c62-8d7e-4a51-9c3a-2f6e1d0a7b11";

/**
 * Drag a sidebar conversation onto the right edge of the main area.
 *
 * Like a hand does it: press, a small nudge past the 5-pixel drag threshold, a pause, then the
 * travel. Tried again if the split does not open — a real pointer crossing the window mid-drag
 * (the person at the computer) is enough to cancel one.
 */
export async function dragIntoSplit(win: LyraWindow, title: string): Promise<void> {
	for (let attempt = 1; attempt <= 3; attempt++) {
		const row = await win.mark(`[...document.querySelectorAll('[data-ly-row]')].find((r) => r.innerText.includes(${JSON.stringify(title)}))?.querySelector('button')`);
		const from = await win.centre(row);
		const to = await win.$<{ x: number; y: number }>(`(() => { const r = document.querySelector('[data-ly-split-root]').getBoundingClientRect(); return { x: r.right - 28, y: r.y + r.height / 2 }; })()`);
		await win.move(from, 6);
		await pause(150);
		const drag = (x: number, y: number) => win.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "left", buttons: 1 });
		await win.send("Input.dispatchMouseEvent", { type: "mousePressed", ...from, button: "left", buttons: 1, clickCount: 1 });
		await pause(80);
		for (let i = 1; i <= 4; i++) {
			await drag(from.x + i * 3, from.y + i);
			await pause(30);
		}
		await pause(120);
		const start = { x: from.x + 12, y: from.y + 4 };
		for (let i = 1; i <= 24; i++) {
			await drag(start.x + ((to.x - start.x) * i) / 24, start.y + ((to.y - start.y) * i) / 24);
			await pause(22);
		}
		await pause(250);
		await win.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...to, button: "left", buttons: 0, clickCount: 1 });
		win.pointer = to;
		const opened = await win
			.until(`document.querySelector('[data-ly-split-root]')?.dataset.lySplitCount === '2'`, 5_000, "分屏打开")
			.then(() => true, () => false);
		if (opened) {
			await pause(1200);
			return;
		}
		console.log(`   分屏没打开，重拖第 ${attempt + 1} 次`);
		await win.key("Escape", "Escape", 27);
		await pause(800);
	}
	throw new Error("拖了三次都没打开分屏");
}

export async function splitScene(lang: Lang): Promise<string[]> {
	const world = await buildWorld(lang);
	let go = () => {};
	const hold = new Promise<void>((resolve) => (go = resolve));
	const hero = heroScript(lang, { hold });
	const tab = tabCellsScript(lang);
	const model = await startModel([hero, tab]);
	const win = await openLyra({
		world,
		lang,
		seed: async (home) => {
			await writeProfile(home, settingsFor({ world, lang, theme: "light", modelPort: model.port }));
			await writeSessions(home, sidebarSessions(world, lang).filter((session) => session.id !== TAB_CELLS_FIXTURE));
		},
	});
	let release = async () => {};
	try {
		await startConversation(win, "aurora-notes", tabCellsAsk(lang));
		await finished(win, model, tab);
		release = await holdVitest(world);
		/*
		 * The lead conversation is created — its question sent — but the model's first reply is held,
		 * so nothing is in flight when the split opens. Opening a split beside a conversation with a
		 * tool running drops that pane's live state (the running command is drawn as failed), and a
		 * message typed into a split's fresh pane goes to whichever conversation has focus.
		 */
		await startConversation(win, "aurora-notes", heroAsk(lang));
		await win.until(`[...document.querySelectorAll('[data-ly-row]')].some((r) => r.innerText.includes(${JSON.stringify(hero.title)}))`, 20_000, "主对话出现在侧栏");
		await pause(600);
		await dragIntoSplit(win, tab.title ?? "");
		const left = await win.$<string>(`document.querySelectorAll('[data-ly-split-pane]')[0].getAttribute('data-ly-split-pane')`);
		// Focus the lead conversation's pane: its status line follows the focused conversation.
		await win.click(`[data-ly-split-pane="${left}"] textarea`);
		await pause(500);
		go();
		await reached(model, hero, hero.steps.length - 1);
		await testRunning(win, `[data-ly-split-pane="${left}"]`);
		await expand(win, `document.querySelector('[data-ly-split-pane="${left}"] [data-ly-run="running"] > button.ly-flow-row')`);
		await pause(800);
		const slack = await fitTurn(win, heroAsk(lang).slice(0, 10), `[data-ly-split-pane="${left}"]`);
		console.log(`   左侧画面余量：${Math.round(slack)}px`);
		const sidebar = await win.$<number>(`Math.round(document.querySelector('.ly-sidebar, aside')?.getBoundingClientRect().width ?? 0)`);
		if (sidebar > 300) throw new Error(`侧栏被拖宽了（${sidebar}px），多半是真实鼠标在拖拽时经过了窗口，重拍`);
		return await shootBoth(win, "split-view", REST);
	} catch (error) {
		console.log("   模型收到的：", model.log.map((entry) => entry.played).join(" → "));
		console.log(
			"   各屏的工具组：",
			await win
				.$<string>(`JSON.stringify([...document.querySelectorAll('[data-ly-split-pane]')].map((pane) => ({ id: pane.getAttribute('data-ly-split-pane').slice(0, 8), runs: [...pane.querySelectorAll('[data-ly-run]')].map((run) => run.getAttribute('data-ly-run') + ' ' + run.firstElementChild?.tagName + ' ' + (run.innerText || '').slice(0, 40)) })))`)
				.catch(() => "(读不到)"),
		);
		throw error;
	} finally {
		go();
		await release().catch(() => {});
		await win.close().catch(() => {});
		await model.close().catch(() => {});
		await world.dispose().catch(() => {});
	}
}
