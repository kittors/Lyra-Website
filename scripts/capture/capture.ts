/**
 * Screenshots of the real Lyra app for the website.
 *
 *   node scripts/capture/capture.ts                      every scene, every language it ships in
 *   node scripts/capture/capture.ts hero-conversation    one scene
 *   node scripts/capture/capture.ts --lang en            one language
 *   node scripts/capture/capture.ts --publish            then copy the shots into src/assets/shots
 *
 * `LYRA_DIR` points at the Lyra repository (default: ../Lyra next to this one). Build it first:
 * `pnpm build` in its packages/desktop. See src/assets/shots/README.md.
 */

import { publish } from "./lib/publish.ts";
import { heroScene } from "./scenes/hero.ts";
import { splitScene } from "./scenes/split.ts";
import { subAgentsScene } from "./scenes/subagents.ts";
import { pluginDetailScene, pluginMarketScene } from "./scenes/plugins.ts";
import { scheduleScene } from "./scenes/schedule.ts";
import { settingsScene } from "./scenes/settings.ts";
import { filePreviewScene } from "./scenes/filepreview.ts";
import { workspaceScene } from "./scenes/workspace.ts";
import { mobileScene } from "./scenes/mobile.ts";
import { pullsScene } from "./scenes/pulls.ts";
import type { Lang } from "./content/types.ts";

interface Scene {
	langs: Lang[];
	run(lang: Lang): Promise<string[]>;
}

const SCENES: Record<string, Scene> = {
	"hero-conversation": { langs: ["zh", "en"], run: heroScene },
	"split-view": { langs: ["zh", "en"], run: splitScene },
	"sub-agents": { langs: ["zh", "en"], run: subAgentsScene },
	"plugin-market": { langs: ["zh", "en"], run: pluginMarketScene },
	"plugin-detail": { langs: ["zh"], run: pluginDetailScene },
	schedule: { langs: ["zh"], run: scheduleScene },
	"settings-models": { langs: ["zh"], run: settingsScene },
	"file-preview": { langs: ["zh"], run: filePreviewScene },
	"workspace-panels": { langs: ["zh"], run: workspaceScene },
	mobile: { langs: ["zh"], run: mobileScene },
	"pull-requests": { langs: ["zh"], run: pullsScene },
};

const args = process.argv.slice(2);
const shouldPublish = args.includes("--publish");
const langFlag = args.indexOf("--lang");
const onlyLang = langFlag >= 0 ? (args[langFlag + 1] as Lang) : undefined;
const names = args.filter((arg, index) => !arg.startsWith("--") && (langFlag < 0 || index !== langFlag + 1));
const chosen = names.length > 0 ? names : Object.keys(SCENES);

for (const name of chosen) {
	const scene = SCENES[name];
	if (!scene) throw new Error(`没有这个场景：${name}。可选：${Object.keys(SCENES).join("、")}`);
	for (const lang of scene.langs) {
		if (onlyLang && lang !== onlyLang) continue;
		console.log(`▶ ${name} (${lang})`);
		const started = Date.now();
		const files = await scene.run(lang);
		console.log(`  ✓ ${((Date.now() - started) / 1000).toFixed(0)}s`);
		if (shouldPublish) await publish(files);
	}
}
