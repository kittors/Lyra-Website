import type { Locale } from "../i18n/index.ts";

/**
 * Sizes and dates, the same at build time and in the browser — the page draws them from the build's
 * release and redraws them from the Worker's, and the two must not disagree about how.
 */

/** Decimal megabytes, as Finder and the phone's own storage screen count them: `219 MB`, `13.1 MB`. */
export function formatSize(bytes: number): string {
	const mb = bytes / 1e6;
	return `${mb >= 100 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

/**
 * The day a release came out, where the reader is likely to be: Beijing time for the Chinese page,
 * UTC for the English one. A release published at 18:00 UTC is already the next day in Shanghai.
 */
export function formatDate(iso: string, locale: Locale): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	if (locale === "en") {
		return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(date);
	}
	const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "numeric", day: "numeric", timeZone: "Asia/Shanghai" }).formatToParts(date);
	const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
	return `${part("year")} 年 ${part("month")} 月 ${part("day")} 日`;
}
