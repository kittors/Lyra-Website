/**
 * A drawing in `aurora-notes`: the empty-notes illustration, then two takes on its dark-mode twin.
 *
 * The first picture is drawn and done. The next two start from it (`#1`, the newest picture in the
 * conversation) and are shot while they are still being drawn, side by side — which also keeps the
 * whole first picture on screen above them.
 */

import type { Script } from "../lib/model.ts";
import type { Lang } from "./types.ts";

const words = {
	zh: {
		ask: "给空笔记页画一张插画：湖面上漂着一只红色纸船，晴天，扁平风格，16:9。",
		title: "空笔记页的插画",
		prompt: "扁平风格插画：平静的蓝色湖面上漂着一只红色折纸船，远处是绿色的山丘，晴朗的天空里有一轮柔和的黄色太阳。线条干净，渐变柔和，画面里不要文字。",
		done: "画好了：晴天的湖面上一只红色纸船，16:9。想换配色或构图，直接说。",
		again: "再画两张深色模式用的，我挑一张：还是这只船，换成夜晚，天上有月亮和星星。",
		night: "把这张图改成夜景：深蓝色的夜空，一轮满月和零散的星星，湖面暗下来、保持平静；红色纸船的样子和位置不变，风格不变。",
	},
	en: {
		ask: "Draw an illustration for the empty notes page: a red paper boat on a lake, sunny, flat style, 16:9.",
		title: "Empty notes illustration",
		prompt: "Flat illustration: a red origami paper boat floating on a calm blue lake, green hills on the horizon, a soft yellow sun in a clear sky. Clean shapes, gentle gradients, no text.",
		done: "Here it is: a red paper boat on a sunny lake, 16:9. Tell me if you want other colours or a different framing.",
		again: "Now two for dark mode so I can pick one: the same boat at night, with a moon and stars.",
		night: "Turn this picture into a night scene: a deep navy sky with a full moon and scattered stars, the lake dark and calm. Keep the red paper boat exactly as it is and where it is, in the same style.",
	},
} as const;

export function drawAsk(lang: Lang): string {
	return words[lang].ask;
}

export function drawAgainAsk(lang: Lang): string {
	return words[lang].again;
}

/** The first picture: one call, then a line about it once it has come back. */
export function drawScript(lang: Lang): Script {
	const w = words[lang];
	return {
		cue: w.ask.slice(0, 12),
		title: w.title,
		steps: [
			{ delay: 400, tools: [{ name: "image_generate", input: { prompt: w.prompt, aspect_ratio: "16:9" } }] },
			{ text: w.done, delay: 300, rate: 60 },
		],
	};
}

/** Two more, drawn from the first. The scene shoots them before the endpoint answers. */
export function drawAgainScript(lang: Lang): Script {
	const w = words[lang];
	return {
		cue: w.again.slice(0, 12),
		steps: [{ delay: 400, tools: [{ name: "image_generate", input: { prompt: w.night, images: ["#1"], aspect_ratio: "16:9", count: 2 } }] }],
	};
}
