import type { ClientHints, Hints } from "./platform.ts";

/**
 * Gathers what `detectPlatform` reads, from this browser. The half of platform detection that
 * touches `navigator` and cannot be tested in Node.
 */

interface UserAgentData {
	getHighEntropyValues(hints: string[]): Promise<ClientHints>;
}

/** What can be read at once, without waiting — enough to tell the OS, not always the CPU. */
export function quickHints(): Hints {
	return { userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints };
}

/**
 * Everything, including the client hints Chromium answers asynchronously and, on a Mac without
 * them, the GPU. Never waits longer than `timeoutMs` for the hints: a page that holds its download
 * button back for a browser that never answers is worse than a guess.
 */
export async function fullHints(timeoutMs = 500): Promise<Hints> {
	const hints = quickHints();
	const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
	if (data?.getHighEntropyValues) {
		hints.clientHints = await Promise.race([
			data.getHighEntropyValues(["platform", "platformVersion", "architecture", "bitness"]).catch(() => null),
			new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
		]);
	}
	// Only worth a WebGL context when nothing better said which chip a Mac has.
	if (!hints.clientHints?.architecture && /Macintosh/.test(hints.userAgent) && (hints.maxTouchPoints ?? 0) <= 1) {
		hints.gpu = readGpu();
	}
	return hints;
}

function readGpu(): string | null {
	try {
		const canvas = document.createElement("canvas");
		const gl = canvas.getContext("webgl");
		if (!gl) return null;
		const debug = gl.getExtension("WEBGL_debug_renderer_info");
		// Firefox dropped the extension but answers the same thing, already sanitised, to RENDERER.
		const renderer: unknown = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
		gl.getExtension("WEBGL_lose_context")?.loseContext();
		return typeof renderer === "string" ? renderer : null;
	} catch {
		return null;
	}
}
