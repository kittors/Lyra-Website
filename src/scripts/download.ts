import type { Release } from "../../shared/release.ts";
import { recommendedFor } from "../i18n/platform.ts";
import { wireCopyButtons } from "./copy.ts";
import { detectPlatform, recommend, type Platform } from "./platform.ts";
import { fullHints } from "./platform-hints.ts";
import { loadRelease, pageLocale } from "./release-client.ts";

/**
 * The download page's part: pick the installer for this machine and say why ("recommended for your
 * macOS 15 (Apple silicon)"), mark it in the full list, keep Linux commands naming the right
 * architecture's files, and let a reader who is sent to the mirror choose GitHub instead.
 *
 * The recommendation waits for the client hints (never longer than half a second) so the text is
 * written once, not corrected in front of the reader.
 */

const locale = pageLocale();
const reco = document.querySelector<HTMLElement>("[data-reco]");

function fileName(id: string, release: Release | null): string | null {
	return release?.assets.find((asset) => asset.id === id)?.name ?? document.querySelector<HTMLElement>(`[data-asset-row="${id}"]`)?.dataset.assetFile ?? null;
}

async function recommendFor(platform: Platform): Promise<void> {
	if (!reco) return;
	const id = recommend(platform);
	const panel = id ? reco.querySelector<HTMLElement>(`[data-reco-panel="${id}"]`) : null;
	if (id && panel) {
		for (const each of reco.querySelectorAll<HTMLElement>("[data-reco-panel]")) each.hidden = each !== panel;
		const caption = panel.querySelector("[data-reco-caption]");
		const text = recommendedFor(platform, locale);
		if (caption && text) caption.textContent = text;
		// Safari on a Mac never says which chip; then the other chip is offered as loudly as the first.
		if (platform.os === "macos" && platform.confidence === "guess") panel.dataset.guess = "";
		document.querySelector(`[data-asset-row="${id}"]`)?.classList.add("is-recommended");
		if (platform.os) document.querySelector(`[data-os-card="${platform.os}"]`)?.classList.add("is-recommended");
	}

	// The first-launch guide for this system is the one to have open.
	const guide = platform.os === "android" || platform.os === "ios" ? "phone" : platform.os;
	const mine = guide ? document.querySelector<HTMLDetailsElement>(`details[data-guide="${guide}"]`) : null;
	if (mine) {
		for (const each of document.querySelectorAll<HTMLDetailsElement>("details[data-guide]")) each.open = each === mine;
	}
	reco.dataset.state = "ready";

	// Linux on Arm: the commands name the arm64 files.
	if (platform.os === "linux" && platform.arch === "arm64") {
		const release = await loadRelease();
		for (const span of document.querySelectorAll<HTMLElement>("[data-linux-kind]")) {
			const armId = span.dataset.linuxKind === "deb" ? "linux-arm64-deb" : "linux-arm64-appimage";
			const name = fileName(armId, release);
			if (!name) continue;
			span.dataset.assetName = armId;
			span.textContent = name;
		}
	}
}

// The source: shown as the Worker says. A reader sent to the mirror may prefer GitHub (behind a
// proxy, say); the Worker honours `?from=` on every download link.
const switcher = document.querySelector<HTMLButtonElement>("[data-source-switch]");
const sourceLabel = document.querySelector<HTMLElement>("[data-release-source]");
let readerSource: "mirror" | "github" = "github";
let chosen: "mirror" | "github" | null = null;

function applySource(): void {
	const effective = chosen ?? readerSource;
	for (const link of document.querySelectorAll<HTMLAnchorElement>("a[data-download-link]")) {
		const url = new URL(link.href, location.href);
		if (chosen && chosen !== readerSource) url.searchParams.set("from", chosen);
		else url.searchParams.delete("from");
		link.href = `${url.pathname}${url.search}`;
	}
	if (sourceLabel) sourceLabel.textContent = (effective === "mirror" ? sourceLabel.dataset.labelMirror : sourceLabel.dataset.labelGithub) ?? "";
	if (switcher) {
		// Only offered to readers the Worker sends to the mirror; everyone else is already on GitHub.
		switcher.hidden = readerSource !== "mirror";
		switcher.textContent = (effective === "mirror" ? switcher.dataset.useGithub : switcher.dataset.useMirror) ?? "";
	}
}

switcher?.addEventListener("click", () => {
	chosen = (chosen ?? readerSource) === "mirror" ? "github" : "mirror";
	applySource();
});

document.addEventListener("lyra:release", (event) => {
	readerSource = (event as CustomEvent<Release>).detail.source;
	applySource();
});

wireCopyButtons();
void fullHints(500).then((hints) => recommendFor(detectPlatform(hints)));
