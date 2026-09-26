import type { Release } from "../../shared/release.ts";
import type { Locale } from "../i18n/index.ts";
import { formatDate, formatSize } from "../lib/format.ts";
import { isRelease } from "../lib/release-shape.ts";

/**
 * The page is drawn from the release the build saw. This asks the Worker for the current one —
 * `GET /api/release`, which also says which mirror this reader's downloads come from — and writes
 * it into the same places, so a release published after the build shows up without a rebuild.
 *
 * Every value lands in an element that already holds the build's value, text for text: nothing
 * appears or disappears, so nothing moves. Anything that fails — no Worker under `astro dev`, a
 * 503 while the mirror has no manifest yet, a malformed answer — leaves the page as it was.
 */

let pending: Promise<Release | null> | null = null;

export function loadRelease(): Promise<Release | null> {
	pending ??= fetch("/api/release", { headers: { accept: "application/json" } })
		.then((response) => (response.ok ? response.json() : null))
		.then((body: unknown) => (isRelease(body) ? body : null))
		.catch(() => null);
	return pending;
}

export function pageLocale(): Locale {
	return document.documentElement.lang === "en" ? "en" : "zh-CN";
}

function each<T extends Element>(selector: string, apply: (element: T) => void): void {
	for (const element of document.querySelectorAll<T>(selector)) apply(element);
}

function setText(element: Element, text: string): void {
	if (element.textContent !== text) element.textContent = text;
}

export function applyRelease(release: Release, locale: Locale = pageLocale()): void {
	each("[data-release-version]", (element) => setText(element, release.version));
	each("[data-release-date]", (element) => setText(element, formatDate(release.publishedAt, locale)));
	each<HTMLAnchorElement>("a[data-release-notes]", (link) => (link.href = release.notesUrl));

	for (const asset of release.assets) {
		each(`[data-asset-size="${asset.id}"]`, (element) => setText(element, formatSize(asset.size)));
		each(`[data-asset-name="${asset.id}"]`, (element) => setText(element, asset.name));
		each(`[data-asset-sha="${asset.id}"]`, (element) => setText(element, asset.sha256));
		each<HTMLAnchorElement>(`a[data-asset-href="${asset.id}"]`, (link) => {
			// Keep a reader's choice of source (`?from=`) across the swap.
			const from = new URL(link.href, location.href).searchParams.get("from");
			link.href = from ? `${asset.href}?from=${from}` : asset.href;
		});
	}

	each<HTMLElement>("[data-release-source]", (element) => {
		element.dataset.source = release.source;
		const label = element.dataset[release.source === "mirror" ? "labelMirror" : "labelGithub"];
		if (label) setText(element, label);
	});
	document.documentElement.dataset.downloadSource = release.source;
	document.dispatchEvent(new CustomEvent<Release>("lyra:release", { detail: release }));
}

/** Fetch and apply, once per page. */
export async function refreshRelease(): Promise<Release | null> {
	const release = await loadRelease();
	if (release) applyRelease(release);
	return release;
}
