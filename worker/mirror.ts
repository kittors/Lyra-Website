import type { Asset, Format, Release } from "../shared/release.ts";
import { downloadUrl, latestRelease, type Latest } from "./github.ts";

/**
 * The mirror: every installer of the latest release, copied from GitHub into R2 and served from
 * `dl.07230805.xyz` to readers in mainland China, where GitHub's download hosts are slow when they
 * answer at all.
 *
 * Nothing pushes files here. The Worker pulls them: a cron every ten minutes, and `POST /api/sync`,
 * which Lyra's release workflow calls the moment a release is published. Each step copies a few
 * files, verified against the release's own `SHA256SUMS` as R2 writes them, and records what is
 * there in `manifest.json` — which is also what the site reads to show the current version. So a
 * release is on the site within seconds of being published, and on the mirror minutes later; until
 * a file has been copied, its download link simply goes to GitHub.
 */
export interface Manifest extends Latest {
	/** File names that are in the bucket, whole and verified. */
	mirrored: string[];
	/** The release before this one, kept on the mirror until the next one replaces it. */
	previousTag: string | null;
	checkedAt: string;
}

export interface MirrorEnv {
	RELEASES: R2Bucket;
	REPOSITORY: string;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const MANIFEST = "manifest.json";

export function keyOf(tag: string, name: string): string {
	return `releases/${tag}/${name}`;
}

export async function readManifest(bucket: R2Bucket): Promise<Manifest | null> {
	const object = await bucket.get(MANIFEST);
	if (!object) return null;
	try {
		return (await object.json()) as Manifest;
	} catch {
		return null;
	}
}

/**
 * What a reader is told about the release: the manifest, with every file's link pointing at this
 * site's `/dl/<id>`, which decides per click where it goes.
 */
export function toRelease(manifest: Manifest, country: string | null): Release {
	return {
		version: manifest.version,
		tag: manifest.tag,
		publishedAt: manifest.publishedAt,
		notesUrl: manifest.notesUrl,
		assets: manifest.assets.map((asset): Asset => ({ ...asset, href: `/dl/${asset.id}` })),
		country,
		source: country === "CN" ? "mirror" : "github",
	};
}

/**
 * Where one file should be fetched from, for one reader.
 *
 * The mirror for mainland China and GitHub for everyone else — and GitHub for everyone while a file
 * is still being copied. `from` lets a reader overrule the guess either way: somebody in China behind
 * a proxy may well prefer GitHub, and somebody abroad may be testing the mirror.
 */
export function destination(
	manifest: Manifest,
	name: string,
	reader: { country: string | null; from: string | undefined },
	origins: { repository: string; mirror: string },
): string {
	const mirrored = manifest.mirrored.includes(name);
	const wantsMirror = reader.from === "mirror" || (reader.from !== "github" && reader.country === "CN");
	return mirrored && wantsMirror ? `${origins.mirror}/${keyOf(manifest.tag, name).split("/").map(encodeURIComponent).join("/")}` : downloadUrl(origins.repository, manifest.tag, name);
}

/**
 * Which files go first. The ones most people download, so that an interrupted run has already done
 * the most good: the digest list (tiny, and every other file is checked against it), then Windows
 * and macOS, the phone, and the rest.
 */
const PRIORITY = ["SHA256SUMS", "win-x64", "mac-arm64", "mac-x64", "android", "win-arm64", "linux-x64-appimage", "linux-x64-deb", "linux-arm64-appimage", "linux-arm64-deb", "ios"];

const CONTENT_TYPE: Record<Format, string> = {
	dmg: "application/x-apple-diskimage",
	exe: "application/vnd.microsoft.portable-executable",
	appimage: "application/vnd.appimage",
	deb: "application/vnd.debian.binary-package",
	apk: "application/vnd.android.package-archive",
	ipa: "application/octet-stream",
};

interface File {
	name: string;
	size: number;
	sha256: string;
	contentType: string;
	rank: number;
}

function filesOf(latest: Latest): File[] {
	const files: File[] = latest.assets.map((asset) => ({
		name: asset.name,
		size: asset.size,
		sha256: asset.sha256,
		contentType: CONTENT_TYPE[asset.format],
		rank: PRIORITY.indexOf(asset.id),
	}));
	if (latest.checksums) files.push({ name: latest.checksums.name, size: latest.checksums.size, sha256: "", contentType: "text/plain; charset=utf-8", rank: 0 });
	return files.sort((a, b) => a.rank - b.rank);
}

export interface StepResult {
	tag: string | null;
	/** Files copied by this step. */
	copied: string[];
	/** Files still to copy after it. */
	remaining: string[];
	/** Everything the release offers is on the mirror. */
	done: boolean;
}

/**
 * One step of keeping the mirror in line with GitHub: learn the latest release, copy up to `copies`
 * of its files that are not in the bucket yet, and record what is there.
 *
 * Small on purpose. A cron run and an HTTP request both have limits on how long they may take, and a
 * release is about two gigabytes; many small steps, each leaving the manifest true, cannot leave the
 * mirror half-written the way one long copy interrupted halfway would.
 */
export async function step(env: MirrorEnv, options: { copies: number; fetcher?: Fetcher; now?: () => Date }): Promise<StepResult> {
	const fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
	const now = options.now ?? (() => new Date());
	const current = await readManifest(env.RELEASES);
	// A GitHub that does not answer this minute is no reason to forget what was known a minute ago.
	const latest = (await latestRelease(env.REPOSITORY, fetcher)) ?? current;
	if (!latest) return { tag: null, copied: [], remaining: [], done: false };

	const files = filesOf(latest);
	const present = new Set<string>();
	for (const file of files) {
		const head = await env.RELEASES.head(keyOf(latest.tag, file.name));
		if (head && head.size === file.size) present.add(file.name);
	}

	// Attempts, not successes, are what is counted: one file failing — a digest mismatch, GitHub
	// dropping the connection — moves on to the next and is tried again next step, but a step never
	// turns into a walk through every file of the release.
	const copied: string[] = [];
	for (const file of files.filter((candidate) => !present.has(candidate.name)).slice(0, options.copies)) {
		if (!(await copy(env, latest.tag, file, fetcher))) continue;
		present.add(file.name);
		copied.push(file.name);
	}

	const previousTag = current && current.tag !== latest.tag ? current.tag : (current?.previousTag ?? null);
	const manifest: Manifest = {
		tag: latest.tag,
		version: latest.version,
		publishedAt: latest.publishedAt,
		notesUrl: latest.notesUrl,
		assets: latest.assets,
		checksums: latest.checksums,
		mirrored: files.filter((file) => present.has(file.name)).map((file) => file.name),
		previousTag,
		checkedAt: now().toISOString(),
	};
	await env.RELEASES.put(MANIFEST, JSON.stringify(manifest), {
		httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
	});

	const remaining = files.filter((file) => !present.has(file.name)).map((file) => file.name);
	// Only once the new release is whole: until then the old one is what the mirror can offer.
	if (remaining.length === 0) await prune(env.RELEASES, [latest.tag, ...(previousTag ? [previousTag] : [])]);
	return { tag: latest.tag, copied, remaining, done: remaining.length === 0 };
}

async function copy(env: MirrorEnv, tag: string, file: File, fetcher: Fetcher): Promise<boolean> {
	try {
		const response = await fetcher(downloadUrl(env.REPOSITORY, tag, file.name), { headers: { "user-agent": "lyra-website (+https://lyra.07230805.xyz)" } });
		if (!response.ok || !response.body) return false;
		const length = Number(response.headers.get("content-length"));
		if (length !== file.size) {
			await response.body.cancel();
			return false;
		}
		await env.RELEASES.put(keyOf(tag, file.name), sized(response.body, length), {
			httpMetadata: {
				contentType: file.contentType,
				contentDisposition: `attachment; filename="${file.name}"`,
				// A release's file never changes under the same name, so every cache may keep it.
				cacheControl: "public, max-age=31536000, immutable",
			},
			// R2 refuses the write if the bytes do not hash to this — a truncated or tampered copy
			// never lands in the bucket, let alone on somebody's machine.
			...(file.sha256 ? { sha256: file.sha256 } : {}),
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * R2 needs to know a streamed body's length before it starts. `FixedLengthStream` says so and fails
 * the write if the stream turns out longer or shorter; outside a Worker — the tests — it does not
 * exist, and the body goes as it is.
 */
function sized(body: ReadableStream, length: number): ReadableStream {
	if (typeof FixedLengthStream !== "function") return body;
	const { readable, writable } = new FixedLengthStream(length);
	void body.pipeTo(writable).catch(() => undefined);
	return readable;
}

/** Everything under `releases/` that is not one of the releases worth keeping. */
async function prune(bucket: R2Bucket, keep: string[]): Promise<void> {
	const listed = await bucket.list({ prefix: "releases/", delimiter: "/" });
	for (const prefix of listed.delimitedPrefixes) {
		const tag = prefix.slice("releases/".length).replace(/\/$/, "");
		if (keep.includes(tag)) continue;
		let cursor: string | undefined;
		do {
			const page = await bucket.list({ prefix, cursor });
			if (page.objects.length) await bucket.delete(page.objects.map((object) => object.key));
			cursor = page.truncated ? page.cursor : undefined;
		} while (cursor);
	}
}
