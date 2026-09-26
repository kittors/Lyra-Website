import { ASSET_IDS, classify, parseChecksums, type Asset } from "../shared/release.ts";

/**
 * The latest Lyra release, as GitHub describes it — before any reader's country or any mirror is
 * involved.
 *
 * Asked two ways. The REST API first: it says when the release was published and lists every file
 * with its size in one answer. But it is rate-limited by IP, sixty an hour without a token, and a
 * Worker shares its outbound addresses with everybody else's Workers — so there will be hours when
 * it answers 403 no matter how politely this asks. The web pages are the fallback, and they carry
 * everything that matters: `releases/latest` redirects to the tag, the release's own `SHA256SUMS`
 * names every file with its digest, and a `HEAD` on each file gives its size.
 */
export interface Latest {
	tag: string;
	version: string;
	publishedAt: string;
	notesUrl: string;
	assets: Omit<Asset, "href">[];
	/** The digest list itself, mirrored alongside the installers so a reader can check them. */
	checksums: { name: string; size: number } | null;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const HEADERS = { "user-agent": "lyra-website (+https://lyra.07230805.xyz)" };

export function downloadUrl(repository: string, tag: string, name: string): string {
	return `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
}

export async function latestRelease(repository: string, fetcher: Fetcher = fetch): Promise<Latest | null> {
	return (await fromApi(repository, fetcher).catch(() => null)) ?? (await fromWeb(repository, fetcher).catch(() => null));
}

interface ApiRelease {
	tag_name?: string;
	published_at?: string;
	html_url?: string;
	draft?: boolean;
	prerelease?: boolean;
	assets?: { name?: string; size?: number }[];
}

async function fromApi(repository: string, fetcher: Fetcher): Promise<Latest | null> {
	const response = await fetcher(`https://api.github.com/repos/${repository}/releases/latest`, {
		headers: { ...HEADERS, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
	});
	if (!response.ok) return null;
	const release = (await response.json()) as ApiRelease;
	if (!release.tag_name || release.draft) return null;

	const files = (release.assets ?? []).filter((file): file is { name: string; size: number } => typeof file.name === "string" && typeof file.size === "number");
	const sums = files.find((file) => file.name === "SHA256SUMS");
	const digests = sums ? await checksums(repository, release.tag_name, fetcher) : new Map<string, string>();
	return build({
		tag: release.tag_name,
		publishedAt: release.published_at ?? new Date().toISOString(),
		notesUrl: release.html_url ?? `https://github.com/${repository}/releases/tag/${release.tag_name}`,
		files,
		digests,
		checksums: sums ?? null,
	});
}

async function fromWeb(repository: string, fetcher: Fetcher): Promise<Latest | null> {
	const pointer = await fetcher(`https://github.com/${repository}/releases/latest`, { headers: HEADERS, redirect: "manual" });
	const location = pointer.headers.get("location") ?? "";
	const tag = /\/releases\/tag\/([^/?#]+)/.exec(location)?.[1];
	if (!tag) return null;
	const decoded = decodeURIComponent(tag);

	// Without the API the digest list is the only index of the release's files there is.
	const sums = await fetcher(downloadUrl(repository, decoded, "SHA256SUMS"), { headers: HEADERS });
	if (!sums.ok) return null;
	const text = await sums.text();
	const digests = parseChecksums(text);
	const published = sums.headers.get("last-modified");

	const files = await Promise.all(
		[...digests.keys()]
			.filter((name) => classify(name))
			.map(async (name) => {
				const head = await fetcher(downloadUrl(repository, decoded, name), { method: "HEAD", headers: HEADERS });
				const size = Number(head.headers.get("content-length"));
				return head.ok && size > 0 ? { name, size } : null;
			}),
	);
	return build({
		tag: decoded,
		publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
		notesUrl: `https://github.com/${repository}/releases/tag/${decoded}`,
		files: files.filter((file): file is { name: string; size: number } => file !== null),
		digests,
		checksums: { name: "SHA256SUMS", size: new TextEncoder().encode(text).byteLength },
	});
}

async function checksums(repository: string, tag: string, fetcher: Fetcher): Promise<Map<string, string>> {
	const response = await fetcher(downloadUrl(repository, tag, "SHA256SUMS"), { headers: HEADERS });
	return response.ok ? parseChecksums(await response.text()) : new Map();
}

function build(input: {
	tag: string;
	publishedAt: string;
	notesUrl: string;
	files: { name: string; size: number }[];
	digests: Map<string, string>;
	checksums: { name: string; size: number } | null;
}): Latest | null {
	const assets: Omit<Asset, "href">[] = [];
	for (const file of input.files) {
		const kind = classify(file.name);
		// One file per id: a release that somehow carried two would otherwise be offered twice.
		if (!kind || assets.some((asset) => asset.id === kind.id)) continue;
		assets.push({ ...kind, name: file.name, size: file.size, sha256: input.digests.get(file.name) ?? "" });
	}
	if (assets.length === 0) return null;
	assets.sort((a, b) => ASSET_IDS.indexOf(a.id) - ASSET_IDS.indexOf(b.id));
	return {
		tag: input.tag,
		version: input.tag.replace(/^v/, ""),
		publishedAt: input.publishedAt,
		notesUrl: input.notesUrl,
		assets,
		checksums: input.checksums,
	};
}
