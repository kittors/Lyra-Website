import { ASSET_IDS, type Asset, type Release } from "../../shared/release.ts";

/**
 * Whether a value really is a `Release` — for the two places one arrives as untyped JSON: the
 * snapshot committed to this repository, and `GET /api/release` in the browser.
 *
 * The browser case is the one that matters. The page is already drawn from the build's copy; an
 * answer that is half a release (a 503's error body, a proxy's HTML, a field renamed on one side)
 * must leave it alone rather than blank out the version or send a download to `undefined`.
 */
export function isRelease(value: unknown): value is Release {
	if (!value || typeof value !== "object") return false;
	const release = value as Record<string, unknown>;
	return (
		typeof release.version === "string" &&
		/^\d+\.\d+\.\d+/.test(release.version) &&
		typeof release.tag === "string" &&
		typeof release.publishedAt === "string" &&
		typeof release.notesUrl === "string" &&
		(release.source === "mirror" || release.source === "github") &&
		(release.country === null || typeof release.country === "string") &&
		Array.isArray(release.assets) &&
		release.assets.length > 0 &&
		release.assets.every(isAsset)
	);
}

function isAsset(value: unknown): value is Asset {
	if (!value || typeof value !== "object") return false;
	const asset = value as Record<string, unknown>;
	return (
		typeof asset.id === "string" &&
		(ASSET_IDS as readonly string[]).includes(asset.id) &&
		typeof asset.name === "string" &&
		typeof asset.size === "number" &&
		Number.isFinite(asset.size) &&
		typeof asset.sha256 === "string" &&
		typeof asset.href === "string" &&
		asset.href.startsWith("/dl/")
	);
}
