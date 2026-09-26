/**
 * Which installer a reader is offered, for the browsers and machines people actually have.
 *
 * Every user agent below is a real one, copied from the browser named. The cases that matter most
 * are the ones where the obvious reading is wrong: Chrome's frozen strings (macOS 10.15.7, Android
 * 10, Linux x86_64 on an Arm board), Safari on a Mac saying nothing about its chip, an iPad claiming
 * to be a Mac, and Windows 10 and 11 sharing `Windows NT 10.0`.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { describePlatform, recommendedFor } from "../src/i18n/platform.ts";
import { alternative, detectPlatform, recommend, type Hints } from "../src/scripts/platform.ts";

const UA = {
	chromeMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
	firefoxMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0",
	safariMojave: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15",
	iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
	ipadOld: "Mozilla/5.0 (iPad; CPU OS 12_5_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1",
	chromeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	edgeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
	firefoxWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
	chromeLinux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	firefoxUbuntu: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
	firefoxLinuxArm: "Mozilla/5.0 (X11; Linux aarch64; rv:132.0) Gecko/20100101 Firefox/132.0",
	chromiumPi32: "Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
	chromeOs: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	chromeAndroid: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
	firefoxAndroid: "Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0",
	googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
};

function detect(hints: Hints) {
	const platform = detectPlatform(hints);
	return { platform, recommended: recommend(platform), alternative: alternative(platform) };
}

describe("macOS", () => {
	test("Chrome on Apple silicon says so in its client hints", () => {
		const { platform, recommended } = detect({
			userAgent: UA.chromeMac,
			maxTouchPoints: 0,
			clientHints: { platform: "macOS", platformVersion: "15.1.0", architecture: "arm", bitness: "64", mobile: false },
		});
		assert.equal(platform.os, "macos");
		assert.equal(platform.version, "15");
		assert.equal(platform.arch, "arm64");
		assert.equal(platform.confidence, "certain");
		assert.equal(recommended, "mac-arm64");
		assert.equal(recommendedFor(platform, "zh-CN"), "为你的 macOS 15（Apple 芯片）推荐");
		assert.equal(recommendedFor(platform, "en"), "Recommended for your macOS 15 (Apple silicon)");
	});

	test("Chrome on an Intel Mac gets the Intel build, and Apple silicon as the alternative", () => {
		const { platform, recommended, alternative } = detect({
			userAgent: UA.chromeMac,
			clientHints: { platform: "macOS", platformVersion: "14.4.1", architecture: "x86", bitness: "64" },
		});
		assert.equal(recommended, "mac-x64");
		assert.equal(alternative, "mac-arm64");
		assert.equal(describePlatform(platform, "zh-CN"), "macOS 14（Intel 芯片）");
	});

	test("the user-agent string's 10.15.7 is frozen, so the version comes only from client hints", () => {
		assert.equal(detectPlatform({ userAgent: UA.safariMac }).version, null);
		assert.equal(detectPlatform({ userAgent: UA.chromeMac, clientHints: { platform: "macOS", platformVersion: "26.0.0", architecture: "arm" } }).version, "26");
		assert.equal(detectPlatform({ userAgent: UA.safariMojave }).version, "10.14");
	});

	test("Safari says nothing about the chip: Apple silicon is a guess, and Intel is offered beside it", () => {
		const { platform, recommended, alternative } = detect({ userAgent: UA.safariMac, maxTouchPoints: 0, gpu: "Apple GPU" });
		assert.equal(platform.os, "macos");
		assert.equal(platform.arch, "arm64");
		assert.equal(platform.confidence, "guess");
		assert.equal(recommended, "mac-arm64");
		assert.equal(alternative, "mac-x64");
		// A guess is not written into the recommendation.
		assert.equal(recommendedFor(platform, "zh-CN"), "为你的 macOS 推荐");
	});

	test("an Intel or AMD GPU gives an Intel Mac away", () => {
		for (const gpu of ["Intel(R) Iris(TM) Plus Graphics 655", "AMD Radeon Pro 5500M OpenGL Engine"]) {
			const { platform, recommended } = detect({ userAgent: UA.firefoxMac, gpu });
			assert.equal(recommended, "mac-x64", gpu);
			assert.equal(platform.confidence, "likely");
		}
	});

	test("an Apple M-series GPU name is an Apple chip", () => {
		const { platform, recommended } = detect({ userAgent: UA.firefoxMac, gpu: "Apple M1" });
		assert.equal(recommended, "mac-arm64");
		assert.equal(platform.confidence, "likely");
		assert.equal(describePlatform(platform, "en"), "macOS (Apple silicon)");
	});
});

describe("iOS and iPadOS", () => {
	test("an iPad asking for the desktop site says Macintosh, but has a touch screen", () => {
		const { platform, recommended } = detect({ userAgent: UA.safariMac, maxTouchPoints: 5 });
		assert.equal(platform.os, "ios");
		assert.equal(platform.tablet, true);
		assert.equal(recommended, "ios");
		assert.equal(describePlatform(platform, "zh-CN"), "iPad");
	});

	test("a Mac with no touch points stays a Mac", () => {
		assert.equal(detectPlatform({ userAgent: UA.safariMac, maxTouchPoints: 0 }).os, "macos");
	});

	test("an iPhone and an older iPad name themselves", () => {
		const phone = detectPlatform({ userAgent: UA.iphone, maxTouchPoints: 5 });
		assert.equal(phone.os, "ios");
		assert.equal(phone.tablet, false);
		assert.equal(describePlatform(phone, "en"), "iPhone");
		assert.equal(recommend(phone), "ios");
		assert.equal(alternative(phone), null);
		assert.equal(detectPlatform({ userAgent: UA.ipadOld, maxTouchPoints: 5 }).tablet, true);
	});
});

describe("Windows", () => {
	test("client hints tell Windows 11 from Windows 10", () => {
		const eleven = detectPlatform({ userAgent: UA.chromeWindows, clientHints: { platform: "Windows", platformVersion: "15.0.0", architecture: "x86", bitness: "64" } });
		assert.equal(eleven.version, "11");
		assert.equal(recommend(eleven), "win-x64");
		assert.equal(recommendedFor(eleven, "zh-CN"), "为你的 Windows 11（x64）推荐");

		const ten = detectPlatform({ userAgent: UA.chromeWindows, clientHints: { platform: "Windows", platformVersion: "10.0.0", architecture: "x86", bitness: "64" } });
		assert.equal(ten.version, "10");
		// 13 is the first Windows 11 value.
		assert.equal(detectPlatform({ userAgent: UA.chromeWindows, clientHints: { platform: "Windows", platformVersion: "13.0.0" } }).version, "11");
	});

	test("Windows on Arm is found by its client hints, since its user-agent string says x64", () => {
		const { platform, recommended, alternative } = detect({
			userAgent: UA.edgeWindows,
			clientHints: { platform: "Windows", platformVersion: "15.0.0", architecture: "arm", bitness: "64" },
		});
		assert.equal(recommended, "win-arm64");
		assert.equal(alternative, "win-x64");
		assert.equal(describePlatform(platform, "zh-CN"), "Windows 11（ARM）");
	});

	test("without client hints, NT 10.0 could be 10 or 11, and x64 is only likely", () => {
		const platform = detectPlatform({ userAgent: UA.firefoxWindows });
		assert.equal(platform.os, "windows");
		assert.equal(platform.version, null);
		assert.equal(platform.arch, "x64");
		assert.equal(platform.confidence, "likely");
		assert.equal(recommend(platform), "win-x64");
		assert.equal(describePlatform(platform, "en"), "Windows (x64)");
	});

	test("32-bit Windows is offered nothing rather than an installer that will not run", () => {
		const platform = detectPlatform({ userAgent: UA.chromeWindows, clientHints: { platform: "Windows", platformVersion: "10.0.0", architecture: "x86", bitness: "32" } });
		assert.equal(platform.arch, "other");
		assert.equal(recommend(platform), null);
	});
});

describe("Linux", () => {
	test("an x86_64 desktop gets the AppImage, which runs on any distribution", () => {
		const { recommended, alternative } = detect({ userAgent: UA.chromeLinux, platform: "Linux x86_64" });
		assert.equal(recommended, "linux-x64-appimage");
		assert.equal(alternative, "linux-x64-deb");
	});

	test("a user agent that names Ubuntu gets the .deb", () => {
		const { platform, recommended, alternative } = detect({ userAgent: UA.firefoxUbuntu, platform: "Linux x86_64" });
		assert.equal(platform.debian, true);
		assert.equal(recommended, "linux-x64-deb");
		assert.equal(alternative, "linux-x64-appimage");
	});

	test("an Arm board is found even when Chrome's frozen string says x86_64", () => {
		assert.equal(recommend(detectPlatform({ userAgent: UA.firefoxLinuxArm, platform: "Linux aarch64" })), "linux-arm64-appimage");
		assert.equal(recommend(detectPlatform({ userAgent: UA.chromeLinux, platform: "Linux aarch64" })), "linux-arm64-appimage");
		assert.equal(
			recommend(detectPlatform({ userAgent: UA.chromeLinux, clientHints: { platform: "Linux", platformVersion: "6.8.0", architecture: "arm", bitness: "64" } })),
			"linux-arm64-appimage",
		);
	});

	test("a 32-bit Raspberry Pi is offered nothing", () => {
		assert.equal(recommend(detectPlatform({ userAgent: UA.chromiumPi32, platform: "Linux armv7l" })), null);
	});

	test("ChromeOS runs Linux apps in a Debian container, so it gets the .deb", () => {
		const platform = detectPlatform({ userAgent: UA.chromeOs });
		assert.equal(platform.os, "linux");
		assert.equal(recommend(platform), "linux-x64-deb");
	});
});

describe("Android", () => {
	test("Chrome's reduced string always says Android 10; the real version is in the client hints", () => {
		assert.equal(detectPlatform({ userAgent: UA.chromeAndroid }).version, null);
		const platform = detectPlatform({ userAgent: UA.chromeAndroid, clientHints: { platform: "Android", platformVersion: "14.0.0", mobile: true } });
		assert.equal(platform.os, "android");
		assert.equal(platform.version, "14");
		assert.equal(recommend(platform), "android");
		assert.equal(recommendedFor(platform, "zh-CN"), "为你的 Android 14 推荐");
	});

	test("Firefox on Android still says its version", () => {
		assert.equal(detectPlatform({ userAgent: UA.firefoxAndroid }).version, "14");
	});
});

test("something that is not a browser on a known system is offered nothing, and named nothing", () => {
	const platform = detectPlatform({ userAgent: UA.googlebot });
	assert.equal(platform.os, null);
	assert.equal(recommend(platform), null);
	assert.equal(describePlatform(platform, "zh-CN"), null);
	assert.equal(recommendedFor(platform, "en"), null);
	assert.equal(detectPlatform({ userAgent: "" }).os, null);
});
