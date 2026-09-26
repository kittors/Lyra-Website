/**
 * Arranging a window for its picture: panels, disclosure, scroll position, and a clock that holds.
 */

import { pause } from "./env.ts";
import type { LyraWindow, Point } from "./window.ts";

/**
 * Stop the page's clock, so light and dark shots taken a second apart read the same.
 *
 * A running command counts seconds on its card and on the status line; left alone, the dark shot
 * says "12s" where the light one said "9s". Timers keep firing — only what they read stands still —
 * and nothing that draws depends on `Date.now` except those readouts.
 */
export async function freezeClock(win: LyraWindow): Promise<void> {
	await win.$(`(() => {
		if (window.__shotClock) return true;
		const now = Date.now();
		const perf = performance.now();
		window.__shotClock = { now, perf, realNow: Date.now, realPerf: performance.now.bind(performance) };
		Date.now = () => now;
		window.__shotFreeze = true;
		return true;
	})()`);
}

export async function thawClock(win: LyraWindow): Promise<void> {
	await win.$(`(() => { const c = window.__shotClock; if (c) { Date.now = c.realNow; delete window.__shotClock; } window.__shotFreeze = false; return true; })()`);
}

/** Drag a pane separator by `dx` pixels with the real pointer. */
export async function dragSeparator(win: LyraWindow, selector: string, dx: number): Promise<void> {
	const from = await win.centre(selector);
	await win.move(from, 4);
	await win.send("Input.dispatchMouseEvent", { type: "mousePressed", ...from, button: "left", buttons: 1, clickCount: 1 });
	const steps = 14;
	for (let i = 1; i <= steps; i++) {
		await win.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x + (dx * i) / steps, y: from.y, button: "left", buttons: 1 });
		await pause(18);
	}
	const to = { x: from.x + dx, y: from.y };
	await win.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...to, button: "left", buttons: 0, clickCount: 1 });
	win.pointer = to;
	await pause(600);
}

/** Open a transcript disclosure (a tool group or a card) found by `finder`, unless it is already open. */
export async function expand(win: LyraWindow, finder: string): Promise<void> {
	const target = await win.mark(finder, "data-shot-expand");
	const open = await win.$<boolean>(`document.querySelector('[data-shot-expand]')?.getAttribute('aria-expanded') === 'true'`);
	if (open) return;
	await win.click(target);
	await pause(700);
}

/** The conversation's scroll viewport, in window coordinates. */
export async function transcriptBox(
	win: LyraWindow,
	pane = '[data-dock-pane="conversation"]',
): Promise<{ top: number; bottom: number; left: number; right: number; scrollTop: number; scrollHeight: number; clientHeight: number }> {
	return win.$(`(() => {
		const el = document.querySelector(${JSON.stringify(`${pane} .ly-scroll-view`)}) || document.querySelector('main .ly-scroll-view');
		const r = el.getBoundingClientRect();
		return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
	})()`);
}

/** Wheel the transcript all the way down: at the bottom it draws no bottom fade. */
export async function scrollToBottom(win: LyraWindow, pane?: string): Promise<void> {
	for (let attempt = 0; attempt < 10; attempt++) {
		const box = await transcriptBox(win, pane);
		const left = box.scrollHeight - box.clientHeight - box.scrollTop;
		if (left < 1) return;
		await win.wheel({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 }, Math.max(60, left + 40));
		await pause(450);
	}
}

/**
 * Scroll the transcript with the real wheel until `selector`'s top edge sits at `y`.
 *
 * The wheel, not `scrollTop`: the transcript follows its bottom until a person scrolls away, and a
 * programmatic scroll does not count — the next layout change pulls it straight back down.
 */
export async function scrollTo(win: LyraWindow, selector: string, y: number, over: Point, pane?: string): Promise<void> {
	for (let attempt = 0; attempt < 12; attempt++) {
		const top = await win.$<number | null>(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? el.getBoundingClientRect().top : null; })()`);
		if (top === null) throw new Error(`没有这个元素：${selector}`);
		const delta = top - y;
		if (Math.abs(delta) < 1.5) return;
		const before = await transcriptBox(win, pane);
		await win.wheel(over, delta);
		await pause(450);
		const after = await transcriptBox(win, pane);
		if (Math.abs(after.scrollTop - before.scrollTop) < 0.5) return; // At an end: it will go no further.
	}
}
