/**
 * The phone: Lyra's mobile app shows the desktop's own interface in a WebView, served by the desktop's
 * sync service with a bridge in place of the desktop preload. Lyra's e2e harness (`startMobile`)
 * builds exactly that page — the real bridge, the real renderer from the sync service — in a window of
 * its own, and this drives it at an iPhone's size: 390×844 points at 3×, with touch.
 *
 * What it does not have is the phone's native chrome: no status bar, no home indicator. The website
 * draws the device around the picture.
 */

import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { LYRA, loadHarness, pause, PORTS } from "./env.ts";
import { installEnglishStandIns } from "./english.ts";
import { LyraWindow, type Point } from "./window.ts";
import { enterWorld, type World } from "./world.ts";

export const PHONE = { width: 390, height: 844, scale: 3 } as const;

/** The middle of the phone's top bar: between the sidebar button and the icons on the right. */
export const PHONE_REST: Point = { x: 195, y: 14 };

export class PhoneWindow extends LyraWindow {
	/** A finger, not a pointer: touch start and end at an element's centre. */
	async tap(target: string | Point): Promise<void> {
		if (typeof target === "string") await this.until(`document.querySelector(${JSON.stringify(target)})?.checkVisibility()`, 20_000, target);
		const at = typeof target === "string" ? await this.centre(target) : target;
		await this.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: at.x, y: at.y }] });
		await pause(70);
		await this.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
		await pause(500);
	}

	async click(target: string | Point): Promise<void> {
		await this.tap(target);
	}

	/**
	 * Park the mouse on the header's blank middle, drop focus, wait out motion.
	 *
	 * A phone has no pointer, but scrolling here is done with the mouse wheel, and a mouse left over
	 * the transcript keeps its scrollbar showing (the thumb appears on hover of the scroll area).
	 */
	async rest(at: Point = PHONE_REST): Promise<void> {
		await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
		this.pointer = at;
		await this.$(`(() => { const el = document.activeElement; if (el && el !== document.body && el.blur) el.blur(); return true; })()`);
		await pause(700);
		await this.settle();
	}
}

/** Open the phone against a desktop whose sync service listens on `port` with `token`. */
export async function openPhone(desktop: LyraWindow, world: World, port: number, token: string): Promise<PhoneWindow> {
	const harness = await loadHarness();
	const mobile = await import(pathToFileURL(join(LYRA, "packages", "desktop", "e2e", "mobile-app.ts")).href);
	const leave = enterWorld(world);
	let phone: { evaluate<T>(e: string): Promise<T>; send<T>(m: string, p?: Record<string, unknown>): Promise<T>; stop(): Promise<void> };
	try {
		phone = await mobile.startMobile(desktop.app.home, { host: "127.0.0.1", port, token, platform: "darwin" }, PORTS.phone);
	} finally {
		leave();
	}
	const deadline = Date.now() + 60_000;
	while (!(await phone.evaluate<boolean>(`Boolean(document.querySelector('.ly-shell'))`).catch(() => false))) {
		if (Date.now() > deadline) {
			await phone.stop();
			throw new Error("手机端界面没有出来");
		}
		await pause(400);
	}
	const grab = await harness.frameGrabber(PORTS.phone);
	await grab.send("Emulation.setDeviceMetricsOverride", { width: PHONE.width, height: PHONE.height, deviceScaleFactor: PHONE.scale, mobile: true });
	await grab.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
	const app = { home: desktop.app.home, evaluate: phone.evaluate, send: phone.send, stop: phone.stop };
	const win = new PhoneWindow(app, grab, desktop.lang, world);
	await win.until(`innerWidth === ${PHONE.width}`, 10_000);
	if (desktop.lang === "en") await installEnglishStandIns(grab);
	await win.$(`(() => {
		if (window.__shotIntervals) return true;
		window.__shotIntervals = true;
		const real = window.setInterval.bind(window);
		window.setInterval = (fn, ms, ...rest) => real((...args) => {
			if (window.__shotFreeze && ms === 4200) return;
			return typeof fn === 'function' ? fn(...args) : undefined;
		}, ms, ...rest);
		return true;
	})()`);
	await pause(1500);
	return win;
}
