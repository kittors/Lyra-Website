/**
 * The Worker end to end, against a fake GitHub and an in-memory R2.
 *
 * What is proved is what a reader and a release depend on: a release published on GitHub reaches the
 * site and then the mirror, one verified file at a time; a file that does not match its digest never
 * lands; a reader in mainland China is sent to the mirror only for files that are really there;
 * GitHub rate-limiting its API does not stop any of it; and old releases leave the bucket only once
 * the new one is whole.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beforeEach, test } from "node:test";

import { app, forget, type Env } from "../worker/index.ts";
import { keyOf, readManifest, step } from "../worker/mirror.ts";

const REPOSITORY = "kittors/Lyra";
const MIRROR = "https://dl.example";

const NAMES = [
	"Lyra-{v}-amd64.deb",
	"Lyra-{v}-android.apk",
	"Lyra-{v}-arm64.AppImage",
	"Lyra-{v}-arm64.deb",
	"Lyra-{v}-arm64.dmg",
	"Lyra-{v}-arm64.exe",
	"Lyra-{v}-arm64.zip",
	"Lyra-{v}-ios-unsigned.ipa",
	"Lyra-{v}-x64.dmg",
	"Lyra-{v}-x64.exe",
	"Lyra-{v}-x64.zip",
	"Lyra-{v}-x86_64.AppImage",
	"Lyra-{v}.exe",
];

// ── A fake GitHub ────────────────────────────────────────────────────

interface FakeRelease {
	tag: string;
	files: Map<string, Uint8Array>;
}

let releases: FakeRelease[] = [];
let apiDown = false;
/** File names whose bytes GitHub serves wrong, as if tampered with or cut short. */
let corrupted = new Set<string>();
let asked: string[] = [];

function release(version: string): FakeRelease {
	const files = new Map<string, Uint8Array>();
	for (const pattern of NAMES) {
		const name = pattern.replace("{v}", version);
		files.set(name, new TextEncoder().encode(`${name} `.repeat(3 + (name.length % 5))));
	}
	const sums = [...files].map(([name, bytes]) => `${createHash("sha256").update(bytes).digest("hex")}  ${name}`).join("\n");
	files.set("SHA256SUMS", new TextEncoder().encode(`${sums}\n`));
	return { tag: `v${version}`, files };
}

function latest(): FakeRelease {
	return releases.at(-1)!;
}

async function github(input: string, init?: RequestInit): Promise<Response> {
	asked.push(`${init?.method ?? "GET"} ${input}`);
	const url = new URL(input);
	if (url.host === "api.github.com" && url.pathname === `/repos/${REPOSITORY}/releases/latest`) {
		if (apiDown) return new Response("rate limited", { status: 403 });
		const current = latest();
		return Response.json({
			tag_name: current.tag,
			published_at: "2026-09-21T18:05:00Z",
			html_url: `https://github.com/${REPOSITORY}/releases/tag/${current.tag}`,
			draft: false,
			assets: [...current.files].map(([name, bytes]) => ({ name, size: bytes.byteLength })),
		});
	}
	if (url.host === "github.com" && url.pathname === `/${REPOSITORY}/releases/latest`) {
		return new Response(null, { status: 302, headers: { location: `https://github.com/${REPOSITORY}/releases/tag/${latest().tag}` } });
	}
	const download = new RegExp(`^/${REPOSITORY}/releases/download/([^/]+)/(.+)$`).exec(url.pathname);
	if (url.host === "github.com" && download) {
		const found = releases.find((candidate) => candidate.tag === decodeURIComponent(download[1]!));
		const name = decodeURIComponent(download[2]!);
		const bytes = found?.files.get(name);
		if (!bytes) return new Response("not found", { status: 404 });
		const served = corrupted.has(name) ? bytes.map((byte) => byte ^ 1) : bytes;
		const headers = { "content-length": String(bytes.byteLength), "last-modified": "Mon, 21 Sep 2026 18:05:00 GMT" };
		return init?.method === "HEAD" ? new Response(null, { headers }) : new Response(served, { headers });
	}
	return new Response("unexpected", { status: 500 });
}

// ── An in-memory R2 ──────────────────────────────────────────────────

class FakeBucket {
	objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();

	async head(key: string) {
		const object = this.objects.get(key);
		return object ? { key, size: object.bytes.byteLength } : null;
	}

	async get(key: string) {
		const object = this.objects.get(key);
		if (!object) return null;
		const text = new TextDecoder().decode(object.bytes);
		return { key, size: object.bytes.byteLength, text: async () => text, json: async () => JSON.parse(text) };
	}

	async put(key: string, value: string | ReadableStream, options?: { sha256?: string; httpMetadata?: { contentType?: string } }) {
		const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(await new Response(value).arrayBuffer());
		// What R2 does with `sha256`: refuse the write when the bytes do not hash to it.
		if (options?.sha256 && createHash("sha256").update(bytes).digest("hex") !== options.sha256) throw new Error("The SHA-256 checksum you specified did not match");
		this.objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
		return { key };
	}

	async list(options: { prefix?: string; delimiter?: string; cursor?: string }) {
		const keys = [...this.objects.keys()].filter((key) => key.startsWith(options.prefix ?? "")).sort();
		if (!options.delimiter) return { objects: keys.map((key) => ({ key })), delimitedPrefixes: [], truncated: false };
		const prefixes = new Set<string>();
		const objects: { key: string }[] = [];
		for (const key of keys) {
			const rest = key.slice((options.prefix ?? "").length);
			const cut = rest.indexOf(options.delimiter);
			if (cut >= 0) prefixes.add((options.prefix ?? "") + rest.slice(0, cut + 1));
			else objects.push({ key });
		}
		return { objects, delimitedPrefixes: [...prefixes], truncated: false };
	}

	async delete(keys: string | string[]) {
		for (const key of Array.isArray(keys) ? keys : [keys]) this.objects.delete(key);
	}
}

let bucket: FakeBucket;
let env: Env;

beforeEach(() => {
	releases = [release("0.9.19")];
	apiDown = false;
	corrupted = new Set();
	asked = [];
	bucket = new FakeBucket();
	forget();
	env = { RELEASES: bucket as unknown as R2Bucket, REPOSITORY, MIRROR_ORIGIN: MIRROR, SYNC_TOKEN: "s3cret", ASSETS: {} as Fetcher };
	// Workers have it; Node does not.
	(crypto.subtle as unknown as { timingSafeEqual?: (a: ArrayBuffer, b: ArrayBuffer) => boolean }).timingSafeEqual ??= (a, b) => Buffer.from(a).equals(Buffer.from(b));
});

async function mirrorAll(): Promise<void> {
	for (let i = 0; i < 20; i += 1) if ((await step(env, { copies: 4, fetcher: github })).done) return;
	assert.fail("the mirror never finished");
}

function reader(path: string, country: string | null, init?: RequestInit): Promise<Response> {
	const request = new Request(`https://lyra.example${path}`, init);
	if (country) Object.defineProperty(request, "cf", { value: { country } });
	return Promise.resolve(app.fetch(request, env));
}

// ── The mirror ───────────────────────────────────────────────────────

test("a release on GitHub reaches the manifest at once, and the mirror a few verified files at a time", async () => {
	const first = await step(env, { copies: 2, fetcher: github });
	assert.equal(first.tag, "v0.9.19");
	assert.deepEqual(first.copied, ["SHA256SUMS", "Lyra-0.9.19-x64.exe"], "the digest list, then the download most people want");
	assert.equal(first.done, false);

	const manifest = await readManifest(bucket as unknown as R2Bucket);
	assert.equal(manifest?.version, "0.9.19");
	assert.deepEqual(
		manifest?.assets.map((asset) => asset.id),
		["mac-arm64", "mac-x64", "win-x64", "win-arm64", "linux-x64-appimage", "linux-arm64-appimage", "linux-x64-deb", "linux-arm64-deb", "android", "ios"],
		"ten installers — not the update zips, not the combined Windows installer",
	);
	assert.match(manifest!.assets[0]!.sha256, /^[0-9a-f]{64}$/);
	assert.deepEqual(manifest?.mirrored, ["SHA256SUMS", "Lyra-0.9.19-x64.exe"]);

	await mirrorAll();
	const whole = await readManifest(bucket as unknown as R2Bucket);
	assert.equal(whole?.mirrored.length, 11, "every installer and the digest list");
	assert.ok(await bucket.head(keyOf("v0.9.19", "Lyra-0.9.19-arm64.dmg")));
	assert.equal(await bucket.head(keyOf("v0.9.19", "Lyra-0.9.19-arm64.zip")), null, "the update zips stay on GitHub");
});

test("a file whose bytes do not match the release's digest never lands, and the others still do", async () => {
	corrupted.add("Lyra-0.9.19-x64.exe");
	const result = await step(env, { copies: 3, fetcher: github });
	assert.deepEqual(result.copied, ["SHA256SUMS", "Lyra-0.9.19-arm64.dmg"]);
	assert.equal(await bucket.head(keyOf("v0.9.19", "Lyra-0.9.19-x64.exe")), null);
	assert.ok(result.remaining.includes("Lyra-0.9.19-x64.exe"), "and it is tried again next time");

	corrupted.clear();
	await mirrorAll();
	assert.ok(await bucket.head(keyOf("v0.9.19", "Lyra-0.9.19-x64.exe")));
});

test("GitHub's API refusing (rate limits are per IP, shared by every Worker) changes nothing", async () => {
	apiDown = true;
	await step(env, { copies: 1, fetcher: github });
	const manifest = await readManifest(bucket as unknown as R2Bucket);
	assert.equal(manifest?.tag, "v0.9.19", "the tag came from the /releases/latest redirect");
	assert.equal(manifest?.assets.length, 10, "the files from SHA256SUMS, their sizes from HEAD");
	assert.equal(manifest?.assets.find((asset) => asset.id === "android")?.size, latest().files.get("Lyra-0.9.19-android.apk")?.byteLength);
	assert.ok(asked.some((line) => line.startsWith("HEAD ")));
});

test("a new release replaces the old one on the mirror only once it is whole, and keeps one before it", async () => {
	releases = [release("0.9.18")];
	await mirrorAll();
	releases.push(release("0.9.19"));
	await mirrorAll();
	releases.push(release("0.9.20"));

	await step(env, { copies: 1, fetcher: github });
	assert.ok(await bucket.head(keyOf("v0.9.18", "Lyra-0.9.18-x64.exe")), "nothing is pruned while the new release is still arriving");
	await mirrorAll();

	const manifest = await readManifest(bucket as unknown as R2Bucket);
	assert.equal(manifest?.tag, "v0.9.20");
	assert.equal(manifest?.previousTag, "v0.9.19");
	assert.equal(await bucket.head(keyOf("v0.9.18", "Lyra-0.9.18-x64.exe")), null, "two releases back is gone");
	assert.ok(await bucket.head(keyOf("v0.9.19", "Lyra-0.9.19-x64.exe")), "the one before is kept");
});

test("GitHub not answering at all keeps the release that was already known", async () => {
	await mirrorAll();
	const offline = async () => new Response("down", { status: 503 });
	const result = await step(env, { copies: 1, fetcher: offline });
	assert.equal(result.tag, "v0.9.19");
	assert.equal((await readManifest(bucket as unknown as R2Bucket))?.mirrored.length, 11);
});

// ── What readers get ─────────────────────────────────────────────────

test("mainland China is sent to the mirror, everyone else to GitHub, and either can choose", async () => {
	await mirrorAll();
	const china = await reader("/dl/mac-arm64", "CN");
	assert.equal(china.status, 302);
	assert.equal(china.headers.get("location"), `${MIRROR}/releases/v0.9.19/Lyra-0.9.19-arm64.dmg`);
	assert.equal(china.headers.get("cache-control"), "no-store");

	const abroad = await reader("/dl/mac-arm64", "US");
	assert.equal(abroad.headers.get("location"), `https://github.com/${REPOSITORY}/releases/download/v0.9.19/Lyra-0.9.19-arm64.dmg`);
	assert.equal((await reader("/dl/mac-arm64", "HK")).headers.get("location"), abroad.headers.get("location"), "Hong Kong is not mainland China");

	assert.match((await reader("/dl/win-x64?from=github", "CN")).headers.get("location")!, /^https:\/\/github\.com\//);
	assert.match((await reader("/dl/win-x64?from=mirror", "US")).headers.get("location")!, /^https:\/\/dl\.example\//);
	assert.equal((await reader("/dl/sha256sums", "CN")).headers.get("location"), `${MIRROR}/releases/v0.9.19/SHA256SUMS`);
	assert.equal((await reader("/dl/nonsense", "CN")).headers.get("location"), "/download/");
});

test("a file not copied yet goes to GitHub even for mainland China", async () => {
	await step(env, { copies: 1, fetcher: github });
	const response = await reader("/dl/linux-arm64-deb", "CN");
	assert.match(response.headers.get("location")!, /^https:\/\/github\.com\/kittors\/Lyra\/releases\/download\/v0\.9\.19\//);
});

test("the release feed: the version, every installer linked through /dl, and where this reader's links lead", async () => {
	await mirrorAll();
	const response = await reader("/api/release", "CN");
	assert.equal(response.headers.get("cache-control"), "private, max-age=60", "it depends on the reader, so no shared cache");
	const body = (await response.json()) as { version: string; source: string; country: string; assets: { id: string; href: string; size: number }[] };
	assert.equal(body.version, "0.9.19");
	assert.equal(body.country, "CN");
	assert.equal(body.source, "mirror");
	assert.equal(body.assets.find((asset) => asset.id === "win-x64")?.href, "/dl/win-x64");
	assert.equal(((await (await reader("/api/release", "DE")).json()) as { source: string }).source, "github");
});

test("the sync hook needs the release workflow's token", async () => {
	assert.equal((await reader("/api/sync", null, { method: "POST" })).status, 401);
	assert.equal((await reader("/api/sync", null, { method: "POST", headers: { authorization: "Bearer wrong" } })).status, 401);
	env.SYNC_TOKEN = undefined;
	assert.equal((await reader("/api/sync", null, { method: "POST", headers: { authorization: "Bearer " } })).status, 401, "unset means refused, not open");
});
