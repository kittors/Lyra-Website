import type { AssetId } from "../../shared/release.ts";

/**
 * Which machine is reading the page, and which installer it wants — from what the browser admits.
 *
 * Pure: the browser glue that gathers the hints is `platform-hints.ts`. That split is what lets
 * `test/platform.test.ts` feed in the user agents of real browsers and check the answer, which is
 * the only way to know this works on machines nobody here owns.
 *
 * What each browser admits, roughly:
 *
 *   - Chromium answers User-Agent Client Hints: the real OS version and the CPU architecture. Its
 *     user-agent string is frozen (macOS 10.15.7, Windows NT 10.0, Android 10) and says little.
 *   - Safari has no client hints and freezes macOS at 10.15.7. The CPU is not in the string at all;
 *     the GPU WebGL reports is the only tell, and newer Safari masks even that. So on a Mac in
 *     Safari the answer is a guess — Apple silicon, since that is what Macs are now — and the page
 *     says so by offering Intel right under it.
 *   - An iPad in Safari says it is a Mac. It is the Mac with a touch screen.
 */

export type PlatformOs = "macos" | "windows" | "linux" | "android" | "ios";

/** What the platform runs. `other` is a CPU Lyra ships nothing for — a 32-bit PC or Pi. */
export type PlatformArch = "arm64" | "x64" | "other";

/** How the architecture was learnt: said outright, inferred, or assumed. */
export type Confidence = "certain" | "likely" | "guess";

export interface ClientHints {
	platform?: string;
	platformVersion?: string;
	architecture?: string;
	bitness?: string;
	mobile?: boolean;
}

export interface Hints {
	/** `navigator.userAgent`. */
	userAgent: string;
	/** `navigator.platform` — deprecated, but it still tells an ARM Linux box from an Intel one. */
	platform?: string;
	/** `navigator.maxTouchPoints` — how an iPad that says it is a Mac gives itself away. */
	maxTouchPoints?: number;
	/** `navigator.userAgentData.getHighEntropyValues(...)`, where the browser has it. */
	clientHints?: ClientHints | null;
	/** WebGL's unmasked renderer, e.g. `Apple M2` or `Intel(R) Iris(TM) Plus Graphics`. */
	gpu?: string | null;
}

export interface Platform {
	/** Null when nothing recognisable was said — a bot, a console, HarmonyOS NEXT. */
	os: PlatformOs | null;
	/**
	 * The version people call it by, where it can be known: `15` for macOS, `11` for Windows, `14`
	 * for Android. Null where the browser freezes it (Safari on a Mac, a user-agent string that says
	 * `Windows NT 10.0`, which Windows 11 says too) — never a guess.
	 */
	version: string | null;
	/** An iPad rather than an iPhone. */
	tablet: boolean;
	/** For the desktop systems; null on a phone, where one file fits all. */
	arch: PlatformArch | null;
	confidence: Confidence | null;
	/** A Debian-family Linux, when the user agent names one — the `.deb` is then the better file. */
	debian: boolean;
}

export function detectPlatform(hints: Hints): Platform {
	const ua = hints.userAgent ?? "";
	const ch = hints.clientHints ?? null;
	const chPlatform = (ch?.platform ?? "").toLowerCase();
	const touch = (hints.maxTouchPoints ?? 0) > 1;

	let os: PlatformOs | null = null;
	if (/iPhone|iPod|iPad/.test(ua)) os = "ios";
	else if (/Android/i.test(ua) || chPlatform === "android") os = "android";
	else if (/Macintosh|Mac OS X/.test(ua) || chPlatform === "macos") os = "macos";
	else if (/Windows/.test(ua) || chPlatform === "windows") os = "windows";
	else if (/CrOS|Linux|X11/.test(ua) || chPlatform === "linux" || chPlatform === "chrome os" || chPlatform === "chromeos") os = "linux";

	// No Mac has a touch screen; an iPad asking for the desktop site does.
	const disguisedIpad = os === "macos" && touch && chPlatform !== "macos";
	if (disguisedIpad) os = "ios";
	const tablet = /iPad/.test(ua) || disguisedIpad;

	const base: Platform = { os, version: null, tablet, arch: null, confidence: null, debian: false };
	if (!os) return base;

	const fromHints = chPlatform !== "" && ch?.platformVersion ? ch.platformVersion : null;

	switch (os) {
		case "macos":
			return { ...base, version: macVersion(ua, fromHints), ...macArch(ch, hints.gpu ?? null) };
		case "windows":
			return { ...base, version: windowsVersion(ua, fromHints), ...desktopArch(ua, hints.platform, ch) };
		case "linux":
			return { ...base, debian: /Ubuntu|Debian|Mint|Pop!_OS|elementary|Kali|Raspbian|CrOS/i.test(ua), ...desktopArch(ua, hints.platform, ch) };
		case "android":
			return { ...base, version: androidVersion(ua, fromHints) };
		case "ios":
			// Safari has frozen the version in this string before; saying the wrong one is worse than none.
			return base;
	}
}

function major(version: string): number {
	return Number.parseInt(version.split(".")[0] ?? "", 10);
}

function macVersion(ua: string, fromHints: string | null): string | null {
	if (fromHints) {
		const [first, second] = fromHints.split(".");
		const x = Number.parseInt(first ?? "", 10);
		if (x === 10 && second) return `10.${second}`;
		if (x >= 11) return String(x);
	}
	// Every browser now says 10.15 whatever the Mac runs; only an older one tells the truth.
	const match = /Mac OS X (\d+)[._](\d+)/.exec(ua);
	if (match && match[1] === "10" && Number(match[2]) < 15) return `10.${match[2]}`;
	return null;
}

function windowsVersion(ua: string, fromHints: string | null): string | null {
	if (fromHints) {
		// Client hints number Windows by its API contract: 13 and up is Windows 11, 1–10 is Windows 10.
		const x = major(fromHints);
		if (x >= 13) return "11";
		if (x >= 1) return "10";
		return null;
	}
	const match = /Windows NT (\d+\.\d+)/.exec(ua);
	const nt: Record<string, string> = { "6.1": "7", "6.2": "8", "6.3": "8.1" };
	return match ? (nt[match[1]!] ?? null) : null;
}

function androidVersion(ua: string, fromHints: string | null): string | null {
	if (fromHints && major(fromHints) > 0) return String(major(fromHints));
	// Chrome's reduced string always says `Android 10; K`, whatever the phone runs.
	if (/Android 10; K\)/.test(ua)) return null;
	const match = /Android (\d+)(?:\.(\d+))?/.exec(ua);
	return match ? match[1]! : null;
}

type ArchAnswer = Pick<Platform, "arch" | "confidence">;

function fromClientHints(ch: ClientHints | null): ArchAnswer | null {
	const architecture = (ch?.architecture ?? "").toLowerCase();
	if (architecture !== "arm" && architecture !== "x86") return null;
	if (ch?.bitness === "32") return { arch: "other", confidence: "certain" };
	return { arch: architecture === "arm" ? "arm64" : "x64", confidence: "certain" };
}

function macArch(ch: ClientHints | null, gpu: string | null): ArchAnswer {
	const hinted = fromClientHints(ch);
	if (hinted) return hinted.arch === "other" ? { arch: "x64", confidence: "certain" } : hinted;
	if (gpu) {
		if (/Intel|AMD|Radeon|NVIDIA|GeForce/i.test(gpu)) return { arch: "x64", confidence: "likely" };
		// `Apple M3` is an Apple chip. A bare `Apple GPU` is what Safari says on any Mac, so it proves nothing.
		if (/Apple M\d/i.test(gpu)) return { arch: "arm64", confidence: "likely" };
	}
	return { arch: "arm64", confidence: "guess" };
}

function desktopArch(ua: string, platform: string | undefined, ch: ClientHints | null): ArchAnswer {
	const hinted = fromClientHints(ch);
	if (hinted) return hinted;
	const said = `${ua} ${platform ?? ""}`;
	if (/aarch64|arm64/i.test(said)) return { arch: "arm64", confidence: "certain" };
	if (/armv\d|armv8l|\barm\b/i.test(said)) return { arch: "other", confidence: "likely" };
	if (/x86_64|amd64|x64|Win64|WOW64/i.test(said)) {
		// Browsers on Windows on Arm say x64 in this string, so from it alone x64 is only likely.
		return { arch: "x64", confidence: /Windows/.test(ua) ? "likely" : "certain" };
	}
	if (/i[3-6]86|x86(?!_64)/i.test(said)) return { arch: "other", confidence: "likely" };
	return { arch: "x64", confidence: "guess" };
}

/** The installer to put first, or null when nothing fits — unknown OS, or a CPU Lyra does not build for. */
export function recommend(platform: Platform): AssetId | null {
	const { os, arch } = platform;
	if (arch === "other") return null;
	switch (os) {
		case "macos":
			return arch === "x64" ? "mac-x64" : "mac-arm64";
		case "windows":
			return arch === "arm64" ? "win-arm64" : "win-x64";
		case "linux":
			if (platform.debian) return arch === "arm64" ? "linux-arm64-deb" : "linux-x64-deb";
			return arch === "arm64" ? "linux-arm64-appimage" : "linux-x64-appimage";
		case "android":
			return "android";
		case "ios":
			return "ios";
		default:
			return null;
	}
}

/**
 * The one other file most worth offering beside the recommendation: the other Mac chip, the other
 * Windows architecture, the other Linux package. Null when there is no near miss to offer.
 */
export function alternative(platform: Platform): AssetId | null {
	switch (recommend(platform)) {
		case "mac-arm64":
			return "mac-x64";
		case "mac-x64":
			return "mac-arm64";
		case "win-x64":
			return "win-arm64";
		case "win-arm64":
			return "win-x64";
		case "linux-x64-appimage":
			return "linux-x64-deb";
		case "linux-x64-deb":
			return "linux-x64-appimage";
		case "linux-arm64-appimage":
			return "linux-arm64-deb";
		case "linux-arm64-deb":
			return "linux-arm64-appimage";
		default:
			return null;
	}
}
