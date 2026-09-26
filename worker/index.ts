import { Hono } from "hono";

import { destination, readManifest, step, toRelease, type Manifest } from "./mirror.ts";

/**
 * The part of the site that cannot be a static file.
 *
 * Everything else — every page, every picture — is served straight from the edge out of `dist/`.
 * This runs only for `/api/*` and `/dl/*` (see `run_worker_first` in `wrangler.jsonc`), because
 * those answers depend on who is asking and on what has been released since the site was built:
 *
 *   - `GET /api/release` — the latest release and, for this reader, where its files come from;
 *   - `GET /dl/:id`      — one installer, redirected to the mirror or to GitHub;
 *   - `POST /api/sync`   — the release workflow saying "a release is out" (needs `SYNC_TOKEN`);
 *   - and a cron, every ten minutes, that notices a release nobody announced.
 */
export interface Env {
	ASSETS: Fetcher;
	RELEASES: R2Bucket;
	REPOSITORY: string;
	MIRROR_ORIGIN: string;
	/** Shared with Lyra's release workflow. Unset means `POST /api/sync` is refused outright. */
	SYNC_TOKEN?: string;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * The manifest, read from R2 at most once a minute per isolate.
 *
 * Every page view asks for the release; a release happens a few times a week. The minute is the
 * longest a new release can take to reach a reader who already has a warm isolate, which is far
 * shorter than it took them to hear about it.
 */
let memo: { manifest: Manifest | null; at: number } | null = null;

/** Drops the remembered manifest — after a sync, and between tests. */
export function forget(): void {
	memo = null;
}
async function manifestOf(env: Env): Promise<Manifest | null> {
	if (memo && Date.now() - memo.at < 60_000) return memo.manifest;
	const manifest = await readManifest(env.RELEASES);
	memo = { manifest, at: Date.now() };
	return manifest;
}

function countryOf(request: Request): string | null {
	const country = (request as Request & { cf?: { country?: unknown } }).cf?.country;
	return typeof country === "string" && /^[A-Z]{2}$/.test(country) ? country : null;
}

app.get("/api/release", async (context) => {
	const manifest = await manifestOf(context.env);
	if (!manifest) return context.json({ error: "not-ready" }, 503, { "cache-control": "no-store" });
	// Private: the answer depends on the reader's country, so no shared cache may hand it to another.
	return context.json(toRelease(manifest, countryOf(context.req.raw)), 200, { "cache-control": "private, max-age=60" });
});

app.get("/dl/:id", async (context) => {
	const manifest = await manifestOf(context.env);
	const id = context.req.param("id");
	if (!manifest) return context.redirect(`https://github.com/${context.env.REPOSITORY}/releases/latest`, 302);
	const name = id === "sha256sums" ? manifest.checksums?.name : manifest.assets.find((asset) => asset.id === id)?.name;
	if (!name) return context.redirect("/download/", 302);
	const location = destination(
		manifest,
		name,
		{ country: countryOf(context.req.raw), from: context.req.query("from") },
		{ repository: context.env.REPOSITORY, mirror: context.env.MIRROR_ORIGIN },
	);
	return new Response(null, { status: 302, headers: { location, "cache-control": "no-store" } });
});

/**
 * One step of the mirror, on request — for Lyra's release workflow, which calls it in a loop right
 * after publishing until it answers `done`. Each call copies one file, so no single request has to
 * outlast a two-gigabyte copy.
 */
app.post("/api/sync", async (context) => {
	const expected = context.env.SYNC_TOKEN;
	const given = context.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
	if (!expected || !(await sameSecret(given, expected))) return context.json({ error: "unauthorized" }, 401);
	const result = await step(context.env, { copies: 1 });
	forget();
	return context.json(result, 200, { "cache-control": "no-store" });
});

/** A comparison whose time does not depend on where the two strings first differ. */
async function sameSecret(given: string, expected: string): Promise<boolean> {
	const encoder = new TextEncoder();
	const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(given)), crypto.subtle.digest("SHA-256", encoder.encode(expected))]);
	return crypto.subtle.timingSafeEqual(a, b);
}

app.all("/api/*", (context) => context.json({ error: "not-found" }, 404));

export default {
	fetch: app.fetch,
	/**
	 * The safety net under `POST /api/sync`: a release published while the site was down, or by
	 * hand, still reaches it within ten minutes. Four files a run is about 800 MB — well inside what
	 * a scheduled run may take — and a whole release in four runs.
	 */
	async scheduled(_controller, env, context) {
		context.waitUntil(step(env, { copies: 4 }).then(() => undefined));
	},
} satisfies ExportedHandler<Env>;

export { app };
