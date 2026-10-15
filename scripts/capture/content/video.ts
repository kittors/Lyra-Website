/**
 * The video shot: in the empty-notes conversation, the dusk picture made into a clip — caught while the
 * video model is still at work on it.
 */

import type { Script } from "../lib/model.ts";
import type { Lang } from "./types.ts";

const words = {
	zh: {
		ask: "把黄昏那张做成 6 秒的视频，纸船慢慢往前漂。",
		prompt: "日落时分，红色纸船在平静的水面上缓缓向前漂，船身两侧荡开细小的涟漪，金色的光在水面上闪烁，薄雾从水面上飘过。镜头缓慢推近，电影感，一镜到底。",
	},
	en: {
		ask: "Turn the dusk one into a 6-second video, the boat drifting slowly forward.",
		prompt: "The red paper boat drifts slowly forward across the calm water at sunset, gentle ripples spreading from its hull, golden light shimmering on the surface, wisps of mist moving over the water. Slow, subtle camera push-in, cinematic, no cuts.",
	},
} as const;

export function filmAsk(lang: Lang): string {
	return words[lang].ask;
}

/** One call, from the newest picture in the conversation — the dusk one. The scene shoots it before it ends. */
export function filmScript(lang: Lang): Script {
	const w = words[lang];
	return {
		cue: w.ask.slice(0, 12),
		steps: [{ delay: 400, tools: [{ name: "video_generate", input: { prompt: w.prompt, image: "#1", duration: 6, aspect_ratio: "16:9", resolution: "720p" } }] }],
	};
}
