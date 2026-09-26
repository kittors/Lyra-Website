import type { AssetId, Os } from "../../shared/release.ts";
import type { Platform } from "../scripts/platform.ts";
import type { Locale } from "./index.ts";

/**
 * How platforms and installers are named, in both languages. Shared by the pages, which draw the
 * names at build time, and the download page's script, which says "recommended for your …" once it
 * knows what "your" is.
 */

interface PlatformText {
	os: Record<Os, string>;
	/** The download button: "下载 macOS 版", "Download for Mac". */
	download: Record<Os, string>;
	/** One line per installer: what it is for. */
	asset: Record<AssetId, string>;
	/** The file kind, shown beside the size. */
	format: Record<AssetId, string>;
	chip: { arm64: string; x64: string };
	arch: { arm64: string; x64: string };
	device: { mac: string; iphone: string; ipad: string };
	/** "为你的 macOS 15（Apple 芯片）推荐" — a function, because Chinese spacing depends on what it ends with. */
	recommendedFor: (platform: string) => string;
	/** Wraps a detail: "macOS 15（Apple 芯片）" / "macOS 15 (Apple silicon)". */
	paren: (outer: string, inner: string) => string;
}

export const PLATFORM_TEXT: Record<Locale, PlatformText> = {
	"zh-CN": {
		os: { macos: "macOS", windows: "Windows", linux: "Linux", android: "Android", ios: "iOS" },
		download: { macos: "下载 macOS 版", windows: "下载 Windows 版", linux: "下载 Linux 版", android: "下载 Android 版", ios: "下载 iOS 版" },
		asset: {
			"mac-arm64": "Apple 芯片",
			"mac-x64": "Intel 芯片",
			"win-x64": "x64",
			"win-arm64": "ARM",
			"linux-x64-appimage": "x64",
			"linux-arm64-appimage": "arm64",
			"linux-x64-deb": "x64",
			"linux-arm64-deb": "arm64",
			android: "通用",
			ios: "未签名",
		},
		format: {
			"mac-arm64": "DMG",
			"mac-x64": "DMG",
			"win-x64": "安装程序",
			"win-arm64": "安装程序",
			"linux-x64-appimage": "AppImage",
			"linux-arm64-appimage": "AppImage",
			"linux-x64-deb": "DEB",
			"linux-arm64-deb": "DEB",
			android: "APK",
			ios: "IPA",
		},
		chip: { arm64: "Apple 芯片", x64: "Intel 芯片" },
		arch: { arm64: "ARM", x64: "x64" },
		device: { mac: "Mac", iphone: "iPhone", ipad: "iPad" },
		// A space sets Latin apart from Han; a full-width bracket already does.
		recommendedFor: (platform) => `为你的 ${platform}${platform.endsWith("）") ? "" : " "}推荐`,
		paren: (outer, inner) => `${outer}（${inner}）`,
	},
	en: {
		os: { macos: "macOS", windows: "Windows", linux: "Linux", android: "Android", ios: "iOS" },
		download: { macos: "Download for Mac", windows: "Download for Windows", linux: "Download for Linux", android: "Download for Android", ios: "Download for iOS" },
		asset: {
			"mac-arm64": "Apple silicon",
			"mac-x64": "Intel",
			"win-x64": "x64",
			"win-arm64": "Arm",
			"linux-x64-appimage": "x64",
			"linux-arm64-appimage": "arm64",
			"linux-x64-deb": "x64",
			"linux-arm64-deb": "arm64",
			android: "Universal",
			ios: "Unsigned",
		},
		format: {
			"mac-arm64": "DMG",
			"mac-x64": "DMG",
			"win-x64": "Installer",
			"win-arm64": "Installer",
			"linux-x64-appimage": "AppImage",
			"linux-arm64-appimage": "AppImage",
			"linux-x64-deb": "DEB",
			"linux-arm64-deb": "DEB",
			android: "APK",
			ios: "IPA",
		},
		chip: { arm64: "Apple silicon", x64: "Intel" },
		arch: { arm64: "Arm", x64: "x64" },
		device: { mac: "Mac", iphone: "iPhone", ipad: "iPad" },
		recommendedFor: (platform) => `Recommended for your ${platform}`,
		paren: (outer, inner) => `${outer} (${inner})`,
	},
};

/**
 * What to call the reader's machine: `macOS 15（Apple 芯片）`, `Windows 11（x64）`, `iPhone`.
 *
 * Only what was actually learnt goes in. A Mac whose chip is a guess is just `macOS` — the page
 * offers the other chip right under the button instead of claiming one.
 */
export function describePlatform(platform: Platform, locale: Locale): string | null {
	const text = PLATFORM_TEXT[locale];
	const { os, version, arch, confidence } = platform;
	if (!os) return null;
	const known = confidence === "certain" || confidence === "likely";
	switch (os) {
		case "macos": {
			const name = version ? `macOS ${version}` : "macOS";
			return known && (arch === "arm64" || arch === "x64") ? text.paren(name, text.chip[arch]) : name;
		}
		case "windows": {
			const name = version ? `Windows ${version}` : "Windows";
			return known && (arch === "arm64" || arch === "x64") ? text.paren(name, text.arch[arch]) : name;
		}
		case "linux":
			return known && (arch === "arm64" || arch === "x64") ? text.paren("Linux", arch) : "Linux";
		case "android":
			return version ? `Android ${version}` : "Android";
		case "ios":
			return platform.tablet ? text.device.ipad : text.device.iphone;
	}
}

export function recommendedFor(platform: Platform, locale: Locale): string | null {
	const name = describePlatform(platform, locale);
	return name ? PLATFORM_TEXT[locale].recommendedFor(name) : null;
}
