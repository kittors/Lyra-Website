/**
 * Two languages: Chinese at the root, English under `/en/`. The documentation follows the same
 * rule (Starlight's `root` and `en` locales), so a path translates by adding or dropping `/en`.
 */

export type Locale = "zh-CN" | "en";

/** `/download/` in this locale: `/download/` or `/en/download/`. */
export function localize(locale: Locale, path: string): string {
	return locale === "en" ? `/en${path}` : path;
}

/** The same page in the other language, from a path without its locale prefix. */
export function otherLocale(locale: Locale): Locale {
	return locale === "en" ? "zh-CN" : "en";
}

export const DOCS_PATH = "/docs/start/intro/";

export const LINKS = {
	github: "https://github.com/kittors/Lyra",
	releases: "https://github.com/kittors/Lyra/releases",
	issues: "https://github.com/kittors/Lyra/issues",
	contributing: "https://github.com/kittors/Lyra/blob/main/CONTRIBUTING.md",
	license: "https://github.com/kittors/Lyra/blob/main/LICENSE",
	market: "https://market.07230805.xyz",
} as const;
