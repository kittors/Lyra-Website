import { ASSET_IDS, classify, parseChecksums, type Asset, type Release } from "../../shared/release.ts";

/**
 * The latest release as GitHub tells it, turned into what the pages draw.
 *
 * The same answer the Worker gives at `/api/release`, minus what only a request can know: the
 * reader's country is null and every link says GitHub, because a build has no reader. The pages
 * render from this, and the browser swaps in the Worker's answer when it arrives.
 *
 * Kept free of the snapshot import so a plain `node` can run it — that is how the snapshot is made.
 */

const REPOSITORY = "kittors/Lyra";

interface GitHubAsset {
	name: string;
	size: number;
	browser_download_url: string;
}

interface GitHubRelease {
	tag_name: string;
	published_at: string | null;
	html_url: string;
	assets: GitHubAsset[];
}

export interface FetchOptions {
	/** A token lifts GitHub's limit of sixty unauthenticated requests an hour — CI shares its IPs. */
	token?: string;
	timeoutMs?: number;
	fetch?: typeof fetch;
}

export async function fetchLatestRelease(options: FetchOptions = {}): Promise<Release> {
	const request = options.fetch ?? fetch;
	const timeoutMs = options.timeoutMs ?? 15_000;
	const headers: Record<string, string> = {
		accept: "application/vnd.github+json",
		"user-agent": "lyra-website-build",
		"x-github-api-version": "2022-11-28",
	};
	if (options.token) headers.authorization = `Bearer ${options.token}`;

	const response = await request(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
		headers,
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!response.ok) throw new Error(`GitHub answered ${response.status} for the latest release`);
	const latest = (await response.json()) as GitHubRelease;

	// The digests are a file on the release, not a field of the API's answer.
	let digests = new Map<string, string>();
	const sums = latest.assets.find((asset) => asset.name === "SHA256SUMS");
	if (sums) {
		const list = await request(sums.browser_download_url, {
			headers: { "user-agent": headers["user-agent"]! },
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (list.ok) digests = parseChecksums(await list.text());
	}

	const assets: Asset[] = [];
	for (const file of latest.assets) {
		const kind = classify(file.name);
		if (!kind || assets.some((asset) => asset.id === kind.id)) continue;
		assets.push({ ...kind, name: file.name, size: file.size, sha256: digests.get(file.name) ?? "", href: `/dl/${kind.id}` });
	}
	assets.sort((a, b) => ASSET_IDS.indexOf(a.id) - ASSET_IDS.indexOf(b.id));

	return {
		version: latest.tag_name.replace(/^v/, ""),
		tag: latest.tag_name,
		publishedAt: latest.published_at ?? "",
		notesUrl: latest.html_url,
		assets,
		country: null,
		source: "github",
	};
}
