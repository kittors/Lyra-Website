import type { Release } from "../../shared/release.ts";
import snapshot from "../data/release-snapshot.json";
import { fetchLatestRelease } from "./release-fetch.ts";
import { isRelease } from "./release-shape.ts";

/**
 * The release the pages are built with: GitHub's latest if it answers, else the snapshot in
 * `src/data/release-snapshot.json`.
 *
 * Asked once per build (and once per `astro dev` process) however many pages draw it. A build that
 * cannot reach GitHub still produces a correct page, only possibly an older version — the browser
 * replaces it with the Worker's answer the moment the page loads, so the snapshot only has to be
 * good enough for a first frame. Refresh it with `node scripts/snapshot-release.ts`.
 */

let pending: Promise<Release> | null = null;

export function getRelease(): Promise<Release> {
	pending ??= load();
	return pending;
}

async function load(): Promise<Release> {
	const fallback = snapshotRelease();
	if (process.env.LYRA_OFFLINE === "1") return fallback;
	try {
		const release = await fetchLatestRelease({ token: process.env.GITHUB_TOKEN });
		if (isRelease(release)) return release;
		console.warn("[release] GitHub's latest release has no installers the site offers; using the snapshot.");
	} catch (error) {
		console.warn(`[release] Could not reach GitHub (${error instanceof Error ? error.message : String(error)}); using the snapshot.`);
	}
	return fallback;
}

function snapshotRelease(): Release {
	if (!isRelease(snapshot)) throw new Error("src/data/release-snapshot.json is not a release. Regenerate it with `node scripts/snapshot-release.ts`.");
	return snapshot;
}
