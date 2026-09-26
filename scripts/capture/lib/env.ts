/**
 * Where things are, and the handful of tools borrowed from the Lyra repository.
 *
 * The capture drives the real app through Lyra's own end-to-end harness rather than a copy of it:
 * `startApp` already knows how to boot the built app on a throwaway profile and wait for its shell,
 * and `frameGrabber` how to hold one DevTools connection open for a burst of screenshots. Both live
 * in `packages/desktop/e2e`, and are imported from wherever `LYRA_DIR` points — read-only, nothing
 * in that repository is written to except by its own `pnpm build`.
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** The website repository's root. */
export const SITE = resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..");

/** The Lyra repository: `LYRA_DIR`, or a sibling checkout named `Lyra`. */
export const LYRA = resolve(process.env.LYRA_DIR ?? join(SITE, "..", "Lyra"));

/** Raw captures, before anyone has looked at them. Ignored by git. */
export const OUT = join(SITE, "scripts", "capture", "out");

/** Where the chosen shots are committed. */
export const SHOTS = join(SITE, "src", "assets", "shots");

/**
 * Debugger ports this capture may use. Other agents' probes run on the machine at the same time and
 * pick their ports from elsewhere; 9790–9799 is this script's own range.
 */
export const PORTS = { desktop: 9790, phone: 9791, spare: 9792 } as const;

export interface RunningApp {
	home: string;
	evaluate<T>(expression: string): Promise<T>;
	send<T>(method: string, params?: Record<string, unknown>): Promise<T>;
	stop(): Promise<void>;
}

export interface Grabber {
	evaluate<T>(expression: string): Promise<T>;
	send<T>(method: string, params?: Record<string, unknown>): Promise<T>;
	close(): void;
}

export interface Harness {
	startApp(options: {
		port: number;
		seed?: (home: string) => Promise<void>;
		scaleFactor?: number;
		reuseHome?: string;
	}): Promise<RunningApp>;
	frameGrabber(port: number): Promise<Grabber>;
	closeListeningServer(server: unknown, ms?: number): Promise<void>;
	stopProcessGroup(child: unknown, graceMs?: number): Promise<void>;
	evaluateRenderer<T>(target: string, expression: string): Promise<T>;
	call<T>(target: string, method: string, params: Record<string, unknown>): Promise<T>;
}

let harness: Harness | undefined;

/** Lyra's e2e helpers, loaded once. Fails with a clear message when the checkout is not where expected. */
export async function loadHarness(): Promise<Harness> {
	if (harness) return harness;
	const e2e = join(LYRA, "packages", "desktop", "e2e");
	if (!existsSync(join(e2e, "app.ts"))) {
		throw new Error(`没找到 Lyra 仓库的 e2e 工具：${e2e}\n用 LYRA_DIR=/path/to/Lyra 指过去。`);
	}
	if (!existsSync(join(LYRA, "packages", "desktop", "out", "main", "index.js"))) {
		throw new Error(`Lyra 还没构建：先在 ${join(LYRA, "packages", "desktop")} 跑 pnpm build。`);
	}
	const app = await import(pathToFileURL(join(e2e, "app.ts")).href);
	const record = await import(pathToFileURL(join(e2e, "record.ts")).href);
	harness = {
		startApp: app.startApp,
		frameGrabber: record.frameGrabber,
		closeListeningServer: app.closeListeningServer,
		stopProcessGroup: app.stopProcessGroup,
		evaluateRenderer: app.evaluateRenderer,
		call: app.call,
	};
	return harness;
}

export const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
