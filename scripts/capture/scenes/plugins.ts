/**
 * `plugin-market` and `plugin-detail` — the real marketplace, as it is today.
 *
 * The catalogue, logos and README come from the public market (market.07230805.xyz), fetched by the
 * app itself. Two skill packs are already installed on the made-up machine, written the way an
 * install leaves them — the package directory and its line in `installs.json` — so a couple of cards
 * read "installed" rather than every one offering the same button. Skill packs only: an installed MCP
 * server would be started by the app, and nothing here should reach for the network on its own.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { sidebarSessions } from "../content/sessions.ts";
import type { Lang } from "../content/types.ts";
import { pause } from "../lib/env.ts";
import { writeSessions } from "../lib/sessions.ts";
import { MARKET, settingsFor, writeProfile } from "../lib/settings.ts";
import { shootBoth } from "../lib/shoot.ts";
import { openLyra, type LyraWindow } from "../lib/window.ts";
import { buildWorld } from "../lib/world.ts";
import { REST } from "./hero.ts";

/** Installed skill packs, and a skill or two from each so the package is a real one. */
const INSTALLED: Record<string, Record<string, string>> = {
	"mattpocock-skills": {
		tdd: "Red, green, refactor: write the failing test first, make it pass, then clean up.",
		"debug-hard-bugs": "Reproduce, bisect and instrument before changing anything.",
	},
	"vercel-skills": {
		"react-best-practices": "Performance rules for React and Next.js: rendering, data fetching, bundles.",
	},
};

interface Entry {
	id: string;
	version?: string;
	commit?: string;
	sha256?: string;
}

async function installSkillPacks(lyraHome: string): Promise<void> {
	const index = (await fetch(MARKET).then((response) => response.json())) as { plugins: Entry[] };
	const ledger: Record<string, unknown> = {};
	for (const [id, skills] of Object.entries(INSTALLED)) {
		const entry = index.plugins.find((one) => one.id === id);
		if (!entry) throw new Error(`市场里没有 ${id} 了，换一个技能包`);
		for (const [name, description] of Object.entries(skills)) {
			const dir = join(lyraHome, "plugins", id, "skills", name);
			await mkdir(dir, { recursive: true });
			await writeFile(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\n${description}\n`);
		}
		ledger[id] = {
			id,
			version: entry.version,
			commit: entry.commit,
			sha256: entry.sha256,
			from: MARKET,
			skills: Object.keys(skills),
			installedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
		};
	}
	await writeFile(join(lyraHome, "installs.json"), JSON.stringify(ledger, null, 2));
}

/** Wait until every logo on screen has arrived and been drawn. */
async function logosLoaded(win: LyraWindow, scope: string): Promise<void> {
	await win.until(
		`(() => { const imgs = [...document.querySelectorAll(${JSON.stringify(`${scope} img`)})].filter((img) => { const r = img.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }); return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0); })()`,
		40_000,
		"图片都加载完",
	);
	await pause(1200);
}

async function openMarket(lang: Lang) {
	const world = await buildWorld(lang);
	const win = await openLyra({
		world,
		lang,
		seed: async (home) => {
			await writeProfile(home, settingsFor({ world, lang, theme: "light" }));
			await writeSessions(home, sidebarSessions(world, lang));
			await installSkillPacks(home);
		},
	});
	await win.clickText(lang === "zh" ? "插件" : "Plugins");
	await win.until(`document.querySelectorAll('[data-market] [data-card]').length > 20`, 40_000, "市场卡片出现");
	await sourcesRead(win, lang);
	await logosLoaded(win, "[data-market]");
	await pinLogoScheme(win);
	return { world, win };
}

/**
 * Every market source read, or reload until it is.
 *
 * The page lists a red "could not read source" line for a source whose fetch failed — the network
 * hiccuping for a moment is enough, and a full run once shipped two English shots with that line
 * in them. Retried with the page's own reload button; a source that keeps failing stops the scene.
 */
async function sourcesRead(win: LyraWindow, lang: Lang): Promise<void> {
	const failed = `(document.querySelector('[data-market]')?.innerText ?? '').includes(${JSON.stringify(lang === "zh" ? "来源读取失败" : "Could not read source")})`;
	for (let attempt = 1; attempt <= 4; attempt++) {
		await pause(1500);
		if (!(await win.$<boolean>(failed))) return;
		console.log(`   市场来源读取失败，刷新第 ${attempt} 次`);
		await win.click(`button[aria-label=${JSON.stringify(lang === "zh" ? "重新读取" : "Read it again")}]`);
		await pause(4000);
		await win.until(`document.querySelectorAll('[data-market] [data-card]').length > 20`, 40_000, "市场卡片出现");
	}
	throw new Error("插件市场的来源一直读不下来，检查网络后重拍");
}

/**
 * Keep card logos drawn in their light scheme — a stand-in for a fix Lyra still needs.
 *
 * Some market icons are SVGs that restyle themselves under `prefers-color-scheme: dark` (Matt
 * Pocock Skills turns its black mark white). Lyra puts such a mark on a white tile, so in the dark
 * theme the tile comes out blank. `color-scheme: light` on the image is the one-line fix; until it
 * lands in Lyra, the capture applies it to the card logos only. `SHOTS_NO_LOGO_FIX=1` turns it off.
 */
async function pinLogoScheme(win: LyraWindow): Promise<void> {
	if (process.env.SHOTS_NO_LOGO_FIX) return;
	await win.$(`(() => {
		const style = document.createElement('style');
		style.dataset.shots = 'logo-scheme';
		style.textContent = '[data-card] img { color-scheme: light; }';
		document.head.appendChild(style);
		return true;
	})()`);
	await pause(300);
}

export async function pluginMarketScene(lang: Lang): Promise<string[]> {
	const { world, win } = await openMarket(lang);
	try {
		return await shootBoth(win, "plugin-market", REST, () => logosLoaded(win, "[data-market]"));
	} finally {
		await win.close().catch(() => {});
		await world.dispose().catch(() => {});
	}
}

export async function pluginDetailScene(lang: Lang): Promise<string[]> {
	const { world, win } = await openMarket(lang);
	try {
		await win.click(`[data-card] button[aria-label="Waza"]`);
		await win.until(`document.querySelector('[data-plugin-detail] .prose-dw, [data-plugin-detail] article, [data-plugin-detail] h1')`, 30_000, "详情页的 README");
		await logosLoaded(win, "[data-plugin-detail]");
		return await shootBoth(win, "plugin-detail", REST, () => logosLoaded(win, "[data-plugin-detail]"));
	} finally {
		await win.close().catch(() => {});
		await world.dispose().catch(() => {});
	}
}
