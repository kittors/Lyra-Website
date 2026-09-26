/**
 * One running Lyra window, and the handful of things a capture does to it.
 *
 * Everything goes through a single DevTools connection that stays open for the whole scene. That is
 * not a nicety: the 1440×900 viewport is a device-metrics override, and an override lives exactly as
 * long as the connection that set it. The window itself cannot be made 900 tall on this machine —
 * macOS clamps it to the visible screen, minus the Dock — so the page is told it is, and lays out as
 * it would at that size. Screenshots come out 2880×1800 at scale factor 2.
 *
 * Clicks are real mouse events at an element's centre, never `.click()`: the sidebar rows and several
 * menus only answer to the pointer, and a synthetic click on them does nothing at all, silently.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { loadHarness, OUT, pause, PORTS, type Grabber, type RunningApp } from "./env.ts";
import { installEnglishStandIns } from "./english.ts";
import { privateMarkerIn } from "./privacy.ts";
import { enterWorld, type World } from "./world.ts";
import type { Lang } from "../content/types.ts";

export const VIEWPORT = { width: 1440, height: 900, scale: 2 } as const;

export type Theme = "light" | "dark";

export interface OpenOptions {
	world: World;
	lang: Lang;
	/** Writes settings.json, sessions and anything else into Lyra's profile directory. */
	seed: (lyraHome: string) => Promise<void>;
	port?: number;
}

export interface Point {
	x: number;
	y: number;
}

export class LyraWindow {
	pointer: Point = { x: 1100, y: 450 };
	readonly app: RunningApp;
	readonly grab: Grabber;
	readonly lang: Lang;
	readonly world: World;

	constructor(app: RunningApp, grab: Grabber, lang: Lang, world: World) {
		this.app = app;
		this.grab = grab;
		this.lang = lang;
		this.world = world;
	}

	/** An expression in the page. Promises are awaited; the value comes back by value. */
	$<T>(expression: string): Promise<T> {
		return this.grab.evaluate<T>(expression);
	}

	send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
		return this.grab.send<T>(method, params);
	}

	/** Poll from Node, not from the page: a page-side wait would run into the 40 s evaluation limit. */
	async until(expression: string, ms = 30_000, what = expression): Promise<void> {
		const end = Date.now() + ms;
		while (Date.now() < end) {
			if (await this.$<boolean>(`Boolean(${expression})`).catch(() => false)) return;
			await pause(150);
		}
		throw new Error(`等不到：${what}`);
	}

	/**
	 * Centre of the first element matching `selector`, scrolled into view if it is not.
	 *
	 * Only when it is off screen: the transcript follows its bottom, and nudging it for an element
	 * already visible would be a scroll nobody asked for.
	 */
	async centre(selector: string): Promise<Point> {
		const point = await this.$<Point | null>(`(async () => {
			const el = document.querySelector(${JSON.stringify(selector)});
			if (!el) return null;
			let r = el.getBoundingClientRect();
			if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) {
				el.scrollIntoView({ block: 'center', inline: 'nearest' });
				await new Promise((resolve) => setTimeout(resolve, 450));
				r = el.getBoundingClientRect();
			}
			return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
		})()`);
		if (!point) throw new Error(`没有这个元素：${selector}`);
		return point;
	}

	async move(to: Point, steps = 8): Promise<void> {
		const from = this.pointer;
		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			this.pointer = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
			await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...this.pointer });
			await pause(12);
		}
	}

	/** Press and release at an element's centre, or at a point, with the real pointer. */
	async click(target: string | Point, options: { button?: "left" | "right"; count?: number } = {}): Promise<void> {
		if (typeof target === "string") await this.until(`document.querySelector(${JSON.stringify(target)})?.checkVisibility()`, 20_000, target);
		const at = typeof target === "string" ? await this.centre(target) : target;
		await this.move(at);
		const button = options.button ?? "left";
		const buttons = button === "left" ? 1 : 2;
		for (let n = 1; n <= (options.count ?? 1); n++) {
			await this.send("Input.dispatchMouseEvent", { type: "mousePressed", ...at, button, buttons, clickCount: n });
			await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...at, button, buttons: 0, clickCount: n });
		}
		await pause(120);
	}

	/** Mark the first element `finder` returns so it can be clicked by a stable selector. */
	async mark(finder: string, name = "data-shot-target"): Promise<string> {
		const found = await this.$<boolean>(`(() => {
			document.querySelectorAll('[${name}]').forEach((el) => el.removeAttribute('${name}'));
			const el = (${finder});
			if (el) el.setAttribute('${name}', '');
			return Boolean(el);
		})()`);
		if (!found) throw new Error(`没找到：${finder}`);
		return `[${name}]`;
	}

	/** A button (or menu item) by its visible text or accessible name. */
	async clickText(text: string, scope = "document", selector = "button, [role=menuitem], [role=tab], a"): Promise<void> {
		const target = await this.mark(
			`[...${scope}.querySelectorAll(${JSON.stringify(selector)})].find((el) => el.checkVisibility() && ((el.innerText || '').trim() === ${JSON.stringify(text)} || el.getAttribute('aria-label') === ${JSON.stringify(text)}))`,
		);
		await this.click(target);
	}

	async wheel(at: Point, deltaY: number): Promise<void> {
		await this.move(at, 2);
		await this.send("Input.dispatchMouseEvent", { type: "mouseWheel", ...at, deltaX: 0, deltaY });
		await pause(60);
	}

	async key(key: string, code = key, keyCode = 0, modifiers = 0): Promise<void> {
		const text = key === "Enter" ? "\r" : undefined;
		await this.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, modifiers, ...(text ? { text } : {}) });
		await this.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, modifiers });
	}

	/** Type as a person would, a few characters at a time, into whatever has focus. */
	async type(text: string): Promise<void> {
		for (const piece of text.match(/[\s\S]{1,6}/g) ?? []) {
			await this.send("Input.insertText", { text: piece });
			await pause(16);
		}
	}

	/** Switch theme or language in the running app, the way the settings page does. */
	async setAppearance(change: { theme?: Theme; locale?: string }): Promise<void> {
		await this.$(`(async () => {
			const s = await window.lyra.settings.get();
			await window.lyra.settings.save({
				...s,
				${change.locale ? `uiLocale: ${JSON.stringify(change.locale)},` : ""}
				appearance: { ...s.appearance${change.theme ? `, theme: ${JSON.stringify(change.theme)}` : ""} },
			});
			return true;
		})()`);
		if (change.theme) await this.until(`document.documentElement.classList.contains(${JSON.stringify(change.theme)})`, 10_000);
		await pause(900);
	}

	/**
	 * Wait until nothing finite is still animating.
	 *
	 * Infinite animations — a spinner, the shimmer on a running row — never finish, and are part of
	 * the state being shown; everything else (a panel sliding in, a card rising) must have landed.
	 */
	async settle(ms = 6_000): Promise<void> {
		const end = Date.now() + ms;
		while (Date.now() < end) {
			const moving = await this.$<number>(`document.getAnimations().filter((a) => {
				if (a.playState !== 'running') return false;
				const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
				return t && Number.isFinite(t.endTime) && t.iterations !== Infinity;
			}).length`).catch(() => 0);
			if (moving === 0) break;
			await pause(120);
		}
		await pause(250);
	}

	/**
	 * Put the pointer somewhere nothing reacts to, drop focus, and wait for hover effects to fade.
	 *
	 * `rest` is a point in the scene known to be empty — a strip of blank transcript, usually.
	 */
	async rest(at: Point): Promise<void> {
		await this.move(at, 6);
		await this.$(`(() => { const el = document.activeElement; if (el && el !== document.body && el.blur) el.blur(); return true; })()`);
		await this.$(`window.__lyraUpdatePreview?.({ info: null }), true`).catch(() => true);
		await pause(700);
		await this.settle();
	}

	/** A PNG of the page, exactly as painted. */
	async png(): Promise<Buffer> {
		const shot = await this.send<{ data: string }>("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
		return Buffer.from(shot.data, "base64");
	}

	/** How many finite animations are running right now — a fade or a slide caught mid-way. */
	async moving(): Promise<number> {
		return this.$<number>(`document.getAnimations().filter((a) => {
			if (a.playState !== 'running') return false;
			const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
			return t && Number.isFinite(t.endTime) && t.iterations !== Infinity;
		}).length`).catch(() => 0);
	}

	/**
	 * A settled picture: rest the pointer, wait out animations, capture — and capture again if
	 * something started moving in the moment between (a status phrase rotating in, say).
	 */
	async capture(rest: Point): Promise<Buffer> {
		await this.rest(rest);
		let png = await this.png();
		for (let attempt = 0; attempt < 6; attempt++) {
			if ((await this.moving()) === 0) break;
			await pause(350);
			await this.settle();
			png = await this.png();
		}
		await this.assertNothingPrivate();
		return png;
	}

	/** Fail the capture when the page shows anything of the machine it really runs on. */
	async assertNothingPrivate(): Promise<void> {
		const text = await this.$<string>(`document.body.innerText + String.fromCharCode(10) + [...document.querySelectorAll('input, textarea')].map((field) => field.value).join(String.fromCharCode(10))`);
		const found = privateMarkerIn(text);
		if (found) throw new Error(`画面里出现了${found}，这张不能用：检查场景的数据`);
	}

	/** Everything the page says, to check two captures show the same words. */
	async words(): Promise<string> {
		return this.$<string>(`document.body.innerText`);
	}

	/** Write a capture into `out/`. */
	async save(name: string, png: Buffer): Promise<string> {
		await mkdir(OUT, { recursive: true });
		const file = join(OUT, `${name}.png`);
		await writeFile(file, png);
		console.log(`   📸 ${name}.png`);
		return file;
	}

	/** Capture and save in one go, for scenes with a single picture per theme. */
	async shoot(name: string, at: Point): Promise<string> {
		return this.save(name, await this.capture(at));
	}

	/** What is on screen, for a failure message that says more than "timed out". */
	async describe(): Promise<string> {
		return this.$<string>(`(document.querySelector('main')?.innerText ?? document.body.innerText).slice(-1500)`).catch(() => "(读不到)");
	}

	async close(): Promise<void> {
		this.grab.close();
		await this.app.stop();
	}
}

/** Boot Lyra on the made-up machine, sized and ready. */
export async function openLyra({ world, lang, seed, port = PORTS.desktop }: OpenOptions): Promise<LyraWindow> {
	const harness = await loadHarness();
	const leave = enterWorld(world);
	let app: RunningApp;
	try {
		app = await harness.startApp({ port, scaleFactor: VIEWPORT.scale, seed });
	} finally {
		leave();
	}
	const grab = await harness.frameGrabber(port);
	await grab.send("Emulation.setDeviceMetricsOverride", {
		width: VIEWPORT.width,
		height: VIEWPORT.height,
		deviceScaleFactor: VIEWPORT.scale,
		mobile: false,
	});
	const window = new LyraWindow(app, grab, lang, world);
	await window.until(`innerWidth === ${VIEWPORT.width} && innerHeight === ${VIEWPORT.height}`, 10_000);
	if (lang === "en") await installEnglishStandIns(grab);
	/*
	 * Let the running line's rotating phrase be paused for a picture.
	 *
	 * The phrase beside a running turn's timer turns over on a 4.2-second interval of its own; a light
	 * and dark pair taken a few seconds apart would otherwise say different things. Installed before
	 * any turn starts, so the interval that drives it is created through this wrapper. Only intervals
	 * of exactly that period are paused, and only while a pair is being taken (see freezeClock).
	 */
	await window.$(`(() => {
		if (window.__shotIntervals) return true;
		window.__shotIntervals = true;
		const real = window.setInterval.bind(window);
		window.setInterval = (fn, ms, ...rest) => real((...args) => {
			if (window.__shotFreeze && ms === 4200) return;
			return typeof fn === 'function' ? fn(...args) : undefined;
		}, ms, ...rest);
		return true;
	})()`);
	await pause(1200);
	return window;
}
