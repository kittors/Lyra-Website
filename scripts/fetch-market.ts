/**
 * The plugin market's logos, copied into this repository for the home page's logo wall.
 *
 *     node scripts/fetch-market.ts
 *
 * The wall is not drawn from the market at run time on purpose: its icon endpoint takes one and a
 * half to three seconds to answer, and a wall of thirty of those would still be filling in while the
 * reader scrolls past it. So the icons are fetched here, once, committed under `src/assets/market/`,
 * and optimised by the build like every other picture on the site. `src/data/market.json` records
 * which ones, in what order, and how big the market was that day.
 *
 * Which ones is a hand-picked list: marks a reader recognises at a glance, from the entries that
 * carry a real logo. An entry that has left the market is skipped, and the list below it tops the
 * wall back up, so re-running this never produces a gap.
 */

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";

import sharp from "sharp";

const ORIGIN = "https://market.07230805.xyz";
const TARGET = 30;

/** In wall order — three rows of ten, colours spread so no row is all one hue. */
const PICKS = [
	"github", "notion", "figma", "slack", "stripe", "cloudflare", "supabase", "mongodb", "redis", "sentry",
	"grafana", "kubernetes", "playwright", "chrome-devtools", "hugging-face", "obsidian", "excel", "atlassian", "aws-documentation", "microsoft-learn",
	"brave-search", "duckduckgo", "expo", "vercel-skills", "firecrawl", "context7", "zotero", "arxiv", "drawio", "google-cloud-skills",
];
/** Taken in order when one of the picks is missing. */
const SPARES = ["anthropic-skills", "git", "wshobson-python", "exa", "shadcn", "tavily", "deepwiki", "dbhub", "trailofbits-static-analysis", "memory"];

const ICON_DIR = new URL("../src/assets/market/", import.meta.url);
const MANIFEST = new URL("../src/data/market.json", import.meta.url);

interface Entry {
	id: string;
	name: string;
	kind: "plugin" | "mcp" | "skill";
	logo?: string;
	brandColor?: string;
}

async function get(url: string, attempts = 3): Promise<Response> {
	let last: unknown;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(60_000), headers: { "user-agent": "lyra-website-fetch-market" } });
			if (response.ok) return response;
			last = new Error(`${response.status} ${response.statusText}`);
		} catch (error) {
			last = error;
		}
	}
	throw new Error(`${url}: ${last instanceof Error ? last.message : String(last)}`);
}

const EXTENSIONS: Record<string, string> = { "image/svg+xml": "svg", "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" };

/**
 * An SVG goes out as a file on this site's own origin, where anybody can open it directly — and an
 * SVG opened directly runs its scripts. None of the market's do, but that is the market's promise,
 * not this site's; one that has anything active in it is rasterised instead.
 */
function isInertSvg(text: string): boolean {
	return !/<script|<foreignObject|\bon[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=\s*["'](?!#|data:image\/)/i.test(text);
}

/**
 * Whether the icon brings its own background — a filled square, like Stripe's or Expo's — or is a
 * bare mark. A filled one is shown edge to edge on its tile; a bare one sits in the middle of a
 * light tile. Decided from the pixels: an icon whose border ring is almost all opaque, and almost
 * all one colour, is a square. (Microsoft's four squares fill the ring too, in four colours.)
 */
async function isFilled(bytes: Buffer): Promise<boolean> {
	const size = 64;
	const { data } = await sharp(bytes, { density: 144 }).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const inset = 6;
	const ring: [number, number, number][] = [];
	let total = 0;
	for (let i = inset; i < size - inset; i++) {
		for (const [x, y] of [[i, inset], [i, size - 1 - inset], [inset, i], [size - 1 - inset, i]] as const) {
			total++;
			const at = (y * size + x) * 4;
			if (data[at + 3]! > 200) ring.push([data[at]!, data[at + 1]!, data[at + 2]!]);
		}
	}
	if (ring.length / total < 0.92) return false;
	const median = [0, 1, 2].map((channel) => ring.map((pixel) => pixel[channel]!).sort((a, b) => a - b)[ring.length >> 1]!);
	const alike = ring.filter((pixel) => pixel.every((value, channel) => Math.abs(value - median[channel]!) < 40)).length;
	return alike / ring.length > 0.85;
}

const index = (await (await get(`${ORIGIN}/v1/index`)).json()) as { updatedAt?: string; plugins: Entry[] };
const byId = new Map(index.plugins.map((entry) => [entry.id, entry]));
const chosen = [...PICKS, ...SPARES].map((id) => byId.get(id)).filter((entry): entry is Entry => Boolean(entry?.logo)).slice(0, TARGET);

await mkdir(ICON_DIR, { recursive: true });
const icons: { id: string; name: string; kind: Entry["kind"]; brandColor: string | null; file: string; filled: boolean }[] = [];

// A few at a time: the endpoint is slow per request, not per byte.
const queue = [...chosen];
await Promise.all(
	Array.from({ length: 6 }, async () => {
		for (let entry = queue.shift(); entry; entry = queue.shift()) {
			const response = await get(`${ORIGIN}/v1/icon/${encodeURIComponent(entry.id)}`);
			const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim();
			let bytes = Buffer.from(await response.arrayBuffer());
			let extension = EXTENSIONS[type];
			if (!extension) throw new Error(`${entry.id}: unexpected icon type ${type || "(none)"}`);
			if (extension === "svg" && !isInertSvg(bytes.toString("utf8"))) {
				bytes = await sharp(bytes, { density: 288 }).resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
				extension = "png";
			}
			const file = `${entry.id}.${extension}`;
			await writeFile(new URL(file, ICON_DIR), bytes);
			icons.push({ id: entry.id, name: entry.name, kind: entry.kind, brandColor: entry.brandColor ?? null, file, filled: await isFilled(bytes) });
			console.log(`  ${file}`);
		}
	}),
);

// Wall order, not arrival order.
const order = chosen.map((entry) => entry.id);
icons.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

// Icons from an earlier run that are no longer on the wall.
const keep = new Set(icons.map((icon) => icon.file));
for (const file of await readdir(ICON_DIR)) {
	if (!keep.has(file) && !file.startsWith(".")) await rm(new URL(file, ICON_DIR));
}

const counts = { plugin: 0, mcp: 0, skill: 0 };
for (const entry of index.plugins) counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;

await writeFile(
	MANIFEST,
	`${JSON.stringify({ fetchedAt: new Date().toISOString().slice(0, 10), total: index.plugins.length, counts, icons }, null, "\t")}\n`,
);
console.log(`${icons.length} icons; the market lists ${index.plugins.length} entries.`);
