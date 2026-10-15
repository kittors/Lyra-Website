/**
 * The pictures the Studio and video shots show — drawn by real image models, through Lyra.
 *
 *   node scripts/capture/art/generate.ts              every family
 *   node scripts/capture/art/generate.ts boat icon    some of them
 *
 * The models are the ones set up in your own Lyra (`~/.lyra`, or `LYRA_REAL_HOME`): whichever
 * providers list `gemini-3.1-flash-image` and `grok-imagine-image-quality`. Only those providers,
 * their sealed keys and the vault key are copied into a throwaway profile, and the app decrypts and
 * calls them itself: this script never holds a key. The conversation around the calls is the scripted
 * model, so the prompts are exactly the ones below. Every call is billed by the provider; calls go one
 * at a time with a pause between, so a pool's quota is not hit in a burst.
 *
 * There is no clip: the xAI account the video model runs on keeps no data (Zero Data Retention), and
 * such a team must hand xAI an `output.upload_url` for every video, which Lyra does not send. The video
 * shot shows a clip being made instead (`scenes/video.ts`).
 *
 * Writes `scripts/capture/assets/<name>.<ext>` and `manifest.json` (model, prompt, size). The files are
 * committed: taking the shots never calls a model.
 */

import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";

import { startConversation } from "../lib/converse.ts";
import { ASSETS, pause, PORTS } from "../lib/env.ts";
import { type Script, startModel } from "../lib/model.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { openLyra, type LyraWindow } from "../lib/window.ts";
import { buildWorld } from "../lib/world.ts";

/** Read before any scene points HOME at the made-up machine. */
const REAL = process.env.LYRA_REAL_HOME ?? join(homedir(), ".lyra");

const IMAGE = "gemini-3.1-flash-image";
const ICON = "grok-imagine-image-quality";

interface Step {
	/** What the person says; its first words pick the scripted reply. */
	ask: string;
	input: Record<string, unknown>;
	/** The file name for what comes back. */
	output: string;
}

interface Family {
	project: string;
	steps: Step[];
}

const FAMILIES: Record<string, Family> = {
	boat: {
		project: "aurora-notes",
		steps: [
			{
				ask: "Boat: the empty notes illustration.",
				input: {
					model: IMAGE,
					aspect_ratio: "16:9",
					prompt:
						"A minimalist, premium editorial photograph: a single red origami paper boat floating on perfectly still water in soft early-morning light. Pale blue sky with a gentle haze, distant misty hills on the horizon, a faint reflection of the boat on the water. Generous negative space, calm and quiet mood, shallow depth of field, natural colours, ultra-detailed, 16:9.",
				},
				output: "boat-day",
			},
			{
				ask: "Night: the same boat for dark mode.",
				input: {
					images: ["#1"],
					aspect_ratio: "16:9",
					prompt:
						"Turn this into a calm moonlit night: a deep navy sky with a full moon and scattered stars, silver moonlight shimmering on the still water, the hills in soft shadow. Keep the red paper boat exactly as it is and where it is, and keep the composition and the photographic style.",
				},
				output: "boat-night",
			},
			{
				ask: "Winter: colder, snow on the shore.",
				input: {
					images: ["#1"],
					aspect_ratio: "16:9",
					prompt:
						"Make this a winter night: light snow falling, snow covering the distant hills and the shoreline, thin sheets of ice at the edges of the water, cold blue tones. Keep the red paper boat, the moon and the composition exactly as they are.",
				},
				output: "boat-winter",
			},
			{
				// Newest first, the day picture is #3 by now.
				ask: "Dusk: back to the day picture.",
				input: {
					images: ["#3"],
					aspect_ratio: "16:9",
					prompt:
						"Change the time of day to golden hour at sunset: a warm amber and rose sky with soft clouds, the sun low behind the hills, a golden path of light on the water and a warm glow on the paper boat. Keep the boat exactly as it is and where it is, and keep the composition.",
				},
				output: "boat-dusk",
			},
		],
	},
	aurora: {
		project: "aurora-notes",
		steps: [
			{
				ask: "Aurora: a sign-in background.",
				input: {
					model: IMAGE,
					aspect_ratio: "16:9",
					prompt:
						"Cinematic landscape photograph: vivid green and violet northern lights rippling across a starry night sky above snow-capped mountain peaks, mirrored in a glassy alpine lake, dark pine forest along the shore. Long exposure, crisp stars, deep blues, ultra-detailed, 16:9.",
				},
				output: "aurora-wide",
			},
			{
				ask: "Tall: the same for phones.",
				input: {
					images: ["#1"],
					aspect_ratio: "9:16",
					prompt:
						"Recompose this scene as a 9:16 vertical image for a phone splash screen: the northern lights sweeping across the upper half of the frame, the snow-capped peaks and their reflection in the lake in the lower half. Same photographic style, colours and mood.",
				},
				output: "aurora-tall",
			},
		],
	},
	// One call per take: the relay answers one picture per request, whatever `n` asks for.
	icon: {
		project: "orbit-cli",
		steps: ["a", "b"].map((take) => ({
			ask: `Icon ${take}: a take for orbit-cli.`,
			input: {
				model: ICON,
				aspect_ratio: "1:1",
				prompt:
					"A premium app icon for a command-line tool called orbit: a glossy 3D planet circled by a thin glowing orbit ring with a tiny satellite, centred on a rounded-square tile with a deep indigo-to-violet gradient. Soft studio lighting, subtle glass highlights, clean and modern, no text, 1:1.",
			},
			output: `icon-${take}`,
		})),
	},
};

/** The providers in your Lyra that serve these models, with only these models, and their sealed keys. */
async function realModels(): Promise<{ providers: Record<string, unknown>[]; secrets: Record<string, string>; ids: Record<string, string> }> {
	const settings = JSON.parse(await readFile(join(REAL, "settings.json"), "utf8")) as { providers?: { id: string; models?: { id: string; modelId: string }[] }[] };
	const sealed = JSON.parse(await readFile(join(REAL, "credentials.json"), "utf8")) as { secrets?: Record<string, string> };
	const wanted = [IMAGE, ICON];
	const providers: Record<string, unknown>[] = [];
	const secrets: Record<string, string> = {};
	const ids: Record<string, string> = {};
	for (const provider of settings.providers ?? []) {
		const models = (provider.models ?? []).filter((model) => wanted.includes(model.modelId) && !ids[model.modelId]);
		if (models.length === 0) continue;
		for (const model of models) ids[model.modelId] = model.id;
		providers.push({ ...provider, models });
		const key = `provider:${provider.id}`;
		if (sealed.secrets?.[key]) secrets[key] = sealed.secrets[key];
	}
	const missing = wanted.filter((model) => !ids[model]);
	if (missing.length) throw new Error(`你的 Lyra 里没有这些模型：${missing.join("、")}`);
	return { providers, secrets, ids };
}

/** One step's replies: the call, then a word once its result is in. */
function scriptFor(step: Step): Script {
	return { cue: step.ask.slice(0, 12), title: step.ask.split(":")[0], steps: [{ delay: 300, tools: [{ name: "image_generate", input: step.input }] }, { text: "Done.", delay: 200 }] };
}

/** Cards in a state, on screen — a conversation kept out of sight is in the document too. */
function shown(state: string): string {
	return `[...document.querySelectorAll('[data-ly-image-card="${state}"]')].filter((el) => el.checkVisibility())`;
}

/** Wait for a new finished card and its picture; a card that failed ends the family with what it says. */
async function drawn(win: LyraWindow, profile: string, before: { cards: number; files: Set<string> }): Promise<string> {
	const end = Date.now() + 8 * 60_000;
	while (Date.now() < end) {
		const failed = await win.$<string | null>(`(() => { const bad = [...${shown("error")}, ...${shown("stopped")}][0]; return bad ? [bad.innerText, ...[...bad.querySelectorAll('[data-ly-tip]')].map((el) => el.getAttribute('data-ly-tip'))].join(' | ') : null; })()`);
		if (failed) throw new Error(`生成失败：${failed.replace(/\s+/g, " ")}`);
		if ((await win.$<number>(`${shown("done")}.length`)) > before.cards) {
			const files = (await readdir(join(profile, "session-media")).catch(() => [] as string[])).filter((file) => !before.files.has(file));
			if (files.length > 0) return files.sort()[0];
		}
		await pause(2000);
	}
	throw new Error("等了 8 分钟还没好");
}

const chosen = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FAMILIES);
for (const name of chosen) if (!FAMILIES[name]) throw new Error(`没有这一组：${name}。可选：${Object.keys(FAMILIES).join("、")}`);

const real = await realModels();
const manifestFile = join(ASSETS, "manifest.json");
const manifest: Record<string, unknown> = JSON.parse(await readFile(manifestFile, "utf8").catch(() => "{}"));
await mkdir(ASSETS, { recursive: true });

const world = await buildWorld("en");
const model = await startModel(chosen.flatMap((name) => FAMILIES[name].steps.map(scriptFor)));
let profile = "";
const win = await openLyra({
	world,
	lang: "en",
	port: PORTS.spare,
	seed: async (home) => {
		profile = home;
		const settings = settingsFor({ world, lang: "en", theme: "light", modelPort: model.port });
		settings.providers = [...(settings.providers as unknown[]), ...real.providers];
		settings.imageModelId = real.ids[IMAGE];
		await writeProfile(home, settings);
		await copyFile(join(REAL, "vault.key"), join(home, "vault.key"));
		await writeFile(join(home, "credentials.json"), JSON.stringify({ version: 1, secrets: real.secrets }));
	},
});
const failed: string[] = [];
try {
	for (const name of chosen) {
		const family = FAMILIES[name];
		console.log(`▶ ${name}`);
		try {
			for (const [index, step] of family.steps.entries()) {
				const before = { cards: await win.$<number>(`${shown("done")}.length`), files: new Set(await readdir(join(profile, "session-media")).catch(() => [] as string[])) };
				const started = Date.now();
				if (index === 0) await startConversation(win, family.project, step.ask);
				else {
					await win.click("main textarea");
					await win.type(step.ask);
					await pause(250);
					await win.key("Enter", "Enter", 13);
				}
				const media = await drawn(win, profile, before);
				const extension = media.split(".").pop() ?? "jpg";
				const file = `${step.output}.${extension}`;
				await copyFile(join(profile, "session-media", media), join(ASSETS, file));
				const meta = await sharp(join(ASSETS, file)).metadata();
				const mimeType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
				manifest[step.output] = { file, mimeType, width: meta.width, height: meta.height, model: String(step.input.model ?? IMAGE), prompt: step.input.prompt };
				await writeFile(manifestFile, `${JSON.stringify(manifest, null, "\t")}\n`);
				console.log(`   🎨 ${file}  ${meta.width}×${meta.height}  ${Math.round((Date.now() - started) / 1000)}s`);
				await win.until(`!document.querySelector('[data-ly-run="running"]') && !document.querySelector('[data-ly-turn-process="running"]')`, 60_000, "这一轮收尾");
				// A pause between calls: a pool that sees a burst cools the whole account down.
				await pause(15_000);
			}
		} catch (error) {
			failed.push(name);
			console.log(`   ✗ ${name}：${error instanceof Error ? error.message : String(error)}`);
			console.log("   对话里最后是：", await win.describe());
		}
	}
} finally {
	// Closing deletes the profile: the copied keys, the vault key and session-media with them.
	await win.close().catch(() => {});
	await model.close().catch(() => {});
	await world.dispose().catch(() => {});
}
console.log(`✓ ${(await readdir(ASSETS)).filter((file) => file !== "manifest.json").length} 张在 scripts/capture/assets/`);
if (failed.length) {
	console.log(`✗ 没画成：${failed.join("、")}`);
	process.exitCode = 1;
}
