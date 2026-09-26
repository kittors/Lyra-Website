import type { ImageMetadata } from "astro";

import type { Locale } from "../i18n/index.ts";

/**
 * The app's screenshots, by scene: the real one when it has been taken, a placeholder until then.
 *
 * Real screenshots are captured from the running app into `src/assets/shots/` as
 * `<scene>-<light|dark>.png`, with `-en` for the English interface. Until one exists, the page uses
 * `src/assets/shots/placeholder/<scene>-<theme>.png`, same name and size — so a capture landing is
 * the whole change, with nothing here to edit and no layout to shift.
 *
 * A real screenshot in the wrong language or the other theme still beats a grey box, so the lookup
 * walks outwards: this theme in this language, the other theme, the other language, then the
 * placeholder.
 */

export const SCENES = [
	"hero-conversation",
	"split-view",
	"sub-agents",
	"plugin-market",
	"plugin-detail",
	"schedule",
	"settings-models",
	"file-preview",
	"workspace-panels",
] as const;
export type Scene = (typeof SCENES)[number];
export type Theme = "light" | "dark";

const real = import.meta.glob<ImageMetadata>("../assets/shots/*.{png,jpg,jpeg,webp}", { eager: true, import: "default" });
const placeholders = import.meta.glob<ImageMetadata>("../assets/shots/placeholder/*.png", { eager: true, import: "default" });

/** File stem → image, whatever the extension. */
function byStem(files: Record<string, ImageMetadata>): Map<string, ImageMetadata> {
	const map = new Map<string, ImageMetadata>();
	for (const [path, image] of Object.entries(files)) {
		const stem = path.split("/").pop()!.replace(/\.[a-z]+$/i, "");
		map.set(stem, image);
	}
	return map;
}

const REAL = byStem(real);
const PLACEHOLDER = byStem(placeholders);

export interface Shot {
	image: ImageMetadata;
	/** False while this is still the placeholder. */
	real: boolean;
}

function candidates(stem: string, theme: Theme, locale: Locale): string[] {
	const other: Theme = theme === "light" ? "dark" : "light";
	const zh = [`${stem}-${theme}`, `${stem}-${other}`];
	const en = [`${stem}-${theme}-en`, `${stem}-${other}-en`];
	return locale === "en" ? [...en, ...zh] : [...zh, ...en];
}

export function shot(scene: Scene, theme: Theme, locale: Locale): Shot {
	for (const name of candidates(scene, theme, locale)) {
		const image = REAL.get(name);
		if (image) return { image, real: true };
	}
	const image = PLACEHOLDER.get(`${scene}-${theme}`);
	if (!image) throw new Error(`No placeholder for the ${scene} screenshot (${theme}).`);
	return { image, real: false };
}

/**
 * The phone's screenshots, `mobile-1` to `mobile-3`, if any have been taken. There is no placeholder
 * for these: without them the phone shows Lyra's mascot instead of a grey rectangle.
 */
export function mobileShots(theme: Theme, locale: Locale): ImageMetadata[] {
	const found: ImageMetadata[] = [];
	for (const n of [1, 2, 3]) {
		const stem = `mobile-${n}`;
		const image = [...candidates(stem, theme, locale), stem, `${stem}-en`].map((name) => REAL.get(name)).find(Boolean);
		if (image) found.push(image);
	}
	return found;
}
