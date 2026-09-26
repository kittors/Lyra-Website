/**
 * The light and the dark picture of one arranged window, a second apart and otherwise identical.
 */

import type { Lang } from "../content/types.ts";
import { freezeClock, thawClock } from "./frame.ts";
import type { LyraWindow, Point, Theme } from "./window.ts";

export function shotName(scene: string, theme: Theme, lang: Lang): string {
	return `${scene}-${theme}${lang === "en" ? "-en" : ""}`;
}

/**
 * Shoot the window in light, switch it to dark, shoot again, and put it back.
 *
 * Switching in the running app rather than starting a second one is what makes the pair match:
 * same scroll position, same open panels, same text — a second launch would re-run the whole scene
 * and land a few pixels somewhere else. The page's clock is stopped for the pair, and if the words
 * on the page still differ between the two captures, the pair is taken again.
 */
export async function shootBoth(win: LyraWindow, scene: string, rest: Point, before?: (theme: Theme) => Promise<void>): Promise<string[]> {
	await freezeClock(win);
	try {
		for (let attempt = 1; attempt <= 4; attempt++) {
			await win.setAppearance({ theme: "light" });
			await before?.("light");
			const light = await win.capture(rest);
			const lightWords = await win.words();
			await win.setAppearance({ theme: "dark" });
			await before?.("dark");
			const dark = await win.capture(rest);
			const darkWords = await win.words();
			if (lightWords === darkWords) {
				return [await win.save(shotName(scene, "light", win.lang), light), await win.save(shotName(scene, "dark", win.lang), dark)];
			}
			console.log(`   浅色和深色两张上的文字不一样，重拍第 ${attempt + 1} 次`);
		}
		throw new Error(`${scene}：浅色和深色总拍不成一样的内容`);
	} finally {
		await thawClock(win).catch(() => {});
		await win.setAppearance({ theme: "light" }).catch(() => {});
	}
}
