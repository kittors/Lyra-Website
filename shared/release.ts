/**
 * What a Lyra release looks like to this site — shared by the Worker that serves it and the pages that
 * draw it, so the two cannot drift apart.
 *
 * A release on GitHub is a tag and a list of files. Which file is for which machine is written in the
 * file's name, by `electron-builder`'s `artifactName` in Lyra's `packages/desktop/electron-builder.yml`
 * and by the phone build: `Lyra-0.9.19-arm64.dmg`, `Lyra-0.9.19-android.apk`. `classify` reads that
 * name back and nothing else, so a new release needs no change here unless Lyra renames its files.
 */

export type Os = "macos" | "windows" | "linux" | "android" | "ios";
export type Arch = "arm64" | "x64" | "universal";
export type Format = "dmg" | "exe" | "appimage" | "deb" | "apk" | "ipa";

/**
 * The installers the site offers, by a stable id that URLs use (`/dl/mac-arm64`). Deliberately not
 * every file on the release: the two macOS `.zip`s exist for in-app updates, and `Lyra-<v>.exe` is a
 * combined Windows installer twice the size of the per-architecture ones — both are on GitHub for
 * whoever wants them, and neither is what a person downloading Lyra is looking for.
 */
export const ASSET_IDS = [
	"mac-arm64",
	"mac-x64",
	"win-x64",
	"win-arm64",
	"linux-x64-appimage",
	"linux-arm64-appimage",
	"linux-x64-deb",
	"linux-arm64-deb",
	"android",
	"ios",
] as const;
export type AssetId = (typeof ASSET_IDS)[number];

export interface Asset {
	id: AssetId;
	os: Os;
	arch: Arch;
	format: Format;
	/** The file's name on the release, e.g. `Lyra-0.9.19-arm64.dmg`. */
	name: string;
	/** Bytes. */
	size: number;
	/** Lower-case hex, from the release's `SHA256SUMS`. Empty when the release has no digest list. */
	sha256: string;
	/** Where this site sends a click: `/dl/<id>`, which picks the mirror or GitHub per reader. */
	href: string;
}

/** The answer of `GET /api/release`. */
export interface Release {
	/** Without the `v`: `0.9.19`. */
	version: string;
	tag: string;
	/** ISO 8601. */
	publishedAt: string;
	/** The release's page on GitHub, where its notes are. */
	notesUrl: string;
	assets: Asset[];
	/** The reader's country as Cloudflare sees it (`CN`, `US`, …), or `null` where it is not known. */
	country: string | null;
	/** Where this reader's `/dl/*` links lead: the mirror for mainland China, GitHub for everyone else. */
	source: "mirror" | "github";
}

/** Which installer a release file is, from its name — or null for the files the site does not offer. */
export function classify(name: string): Pick<Asset, "id" | "os" | "arch" | "format"> | null {
	const match = /^Lyra-\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+?)?-(arm64|x64|amd64|x86_64|android|ios-unsigned)\.(dmg|exe|AppImage|deb|apk|ipa)$/.exec(name);
	if (!match) return null;
	const [, tail, extension] = match;
	switch (extension) {
		case "dmg":
			return tail === "arm64" ? { id: "mac-arm64", os: "macos", arch: "arm64", format: "dmg" } : tail === "x64" ? { id: "mac-x64", os: "macos", arch: "x64", format: "dmg" } : null;
		case "exe":
			return tail === "arm64" ? { id: "win-arm64", os: "windows", arch: "arm64", format: "exe" } : tail === "x64" ? { id: "win-x64", os: "windows", arch: "x64", format: "exe" } : null;
		case "AppImage":
			return tail === "arm64" ? { id: "linux-arm64-appimage", os: "linux", arch: "arm64", format: "appimage" } : tail === "x86_64" ? { id: "linux-x64-appimage", os: "linux", arch: "x64", format: "appimage" } : null;
		case "deb":
			return tail === "arm64" ? { id: "linux-arm64-deb", os: "linux", arch: "arm64", format: "deb" } : tail === "amd64" ? { id: "linux-x64-deb", os: "linux", arch: "x64", format: "deb" } : null;
		case "apk":
			return tail === "android" ? { id: "android", os: "android", arch: "universal", format: "apk" } : null;
		case "ipa":
			return tail === "ios-unsigned" ? { id: "ios", os: "ios", arch: "universal", format: "ipa" } : null;
		default:
			return null;
	}
}

/** `SHA256SUMS` — `sha256sum`'s own format, `<hex>  <name>` per line — as a map from name to digest. */
export function parseChecksums(text: string): Map<string, string> {
	const digests = new Map<string, string>();
	for (const line of text.split(/\r?\n/)) {
		const match = /^([0-9a-fA-F]{64})\s+\*?(.+)$/.exec(line.trim());
		if (match) digests.set(match[2]!.trim(), match[1]!.toLowerCase());
	}
	return digests;
}
