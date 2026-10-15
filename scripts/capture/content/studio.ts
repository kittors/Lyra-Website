/**
 * What was drawn this week, in three conversations: the Studio's album, and the video page's
 * conversation.
 *
 * - `aurora-notes`, yesterday and this morning: a picture for the empty notes page — a red paper boat
 *   on a lake in the early morning, then the same boat on a moonlit night and on a winter night; then
 *   back to the morning picture for dusk. One family of four, with a branch.
 * - `aurora-notes`, late this morning: a sign-in background, and a tall version for phones.
 * - `orbit-cli`, three days ago: two takes on an icon, from one call.
 *
 * The pictures are real (`art/generate.ts`). The English prompts are the ones that made them, read
 * from the manifest; the Chinese ones say the same in Chinese, as the model would have written them in
 * a conversation held in Chinese.
 */

import { type Art, type ArtName, type Exchange, recordConversation } from "../lib/drawings.ts";
import type { FixtureSession } from "../lib/sessions.ts";
import { localMoment, type World } from "../lib/world.ts";
import type { Lang } from "./types.ts";

interface Words {
	ask: string;
	reply: string;
	/** The prompt in Chinese; in English it is the real one. */
	prompt?: string;
}

type Made = Exclude<ArtName, "icon-a" | "icon-b"> | "icon";

const words: Record<Lang, { titles: { boat: string; aurora: string; icon: string }; made: Record<Made, Words> }> = {
	zh: {
		titles: { boat: "空笔记页的配图", aurora: "登录页的背景图", icon: "orbit-cli 的图标" },
		made: {
			"boat-day": {
				ask: "给空笔记页配一张图：清晨的湖面上漂着一只红色纸船，安静，多留白，16:9。",
				prompt: "极简、高级感的杂志风摄影：清晨柔和的光线里，一只红色折纸船漂在平静如镜的湖面上。淡蓝色的天空笼着薄雾，远处是朦胧的山丘，水面上有纸船淡淡的倒影。大量留白，安静克制，浅景深，自然色彩，细节丰富，16:9。",
				reply: "画好了：清晨的湖面上一只红色纸船，四周留了很多白。",
			},
			"boat-night": {
				ask: "再来一张深色模式用的：同一只船，换成有月亮的夜晚。",
				prompt: "把这张改成安静的月夜：深蓝色的夜空里一轮满月和零散的星星，银色的月光在平静的水面上闪烁，山丘隐在柔和的阴影里。红色纸船保持原样、位置不变，构图和摄影风格也不变。",
				reply: "夜晚版：满月和星星，月光落在水面上，船没有动。",
			},
			"boat-winter": {
				ask: "再冷一点，像冬天的夜里，岸上有雪。",
				prompt: "改成冬天的夜晚：飘着小雪，远处的山丘和岸边覆着雪，水边结了薄冰，整体是冷蓝色调。红色纸船、月亮和构图都保持不变。",
				reply: "改冷了：山上和岸边积了雪，水边结了薄冰，还在下小雪。",
			},
			"boat-dusk": {
				ask: "回到清晨那张，改成黄昏，给「同步完成」的提示页用。",
				prompt: "把时间改成日落时分的黄金时刻：琥珀色和玫瑰色的天空飘着柔软的云，太阳低低地落在山丘后面，水面上有一道金色的光，纸船被映得暖暖的。纸船保持原样、位置不变，构图不变。",
				reply: "黄昏版：太阳落到了山后，水面上是一道金色的光。",
			},
			"aurora-wide": {
				ask: "给登录页做一张背景：极光下的雪山和湖面，16:9。",
				prompt: "电影感的风光摄影：绿色和紫色的极光在满天星斗的夜空中舞动，下面是覆雪的山峰，倒映在如镜的高山湖面上，岸边是深色的松林。长曝光，星点清晰，深蓝色调，细节丰富，16:9。",
				reply: "画好了：极光下的雪山和松林，湖面上有倒影。",
			},
			"aurora-tall": {
				ask: "再做一版竖的，9:16，给手机端的启动页用。",
				prompt: "把这张图重新构图成 9:16 的竖版，用作手机启动页：极光铺满画面的上半部分，覆雪的山峰和湖中的倒影放在下半部分。摄影风格、色彩和氛围保持不变。",
				reply: "竖版做好了，9:16，极光在上半部分。",
			},
			icon: {
				ask: "给 orbit-cli 做个图标：一颗带轨道的行星，要有质感，出两版我挑。",
				prompt: "命令行工具 orbit 的高级感应用图标：一颗有光泽的 3D 行星，被一条发光的细轨道环绕，轨道上有一颗小卫星，居中放在深靛蓝到紫色渐变的圆角方形底板上。柔和的棚拍光，细微的玻璃高光，干净现代，不要文字，1:1。",
				reply: "两版都在这里，挑一张顺眼的，我再接着调。",
			},
		},
	},
	en: {
		titles: { boat: "A picture for empty notes", aurora: "Sign-in page background", icon: "An icon for orbit-cli" },
		made: {
			"boat-day": {
				ask: "A picture for the empty notes page: a red paper boat on a lake in the early morning, quiet, lots of empty space, 16:9.",
				reply: "Here it is: a red paper boat on a still lake in the early morning, with plenty of space around it.",
			},
			"boat-night": { ask: "Now one for dark mode: the same boat on a moonlit night.", reply: "The night version: a full moon and stars, moonlight on the water, the boat just where it was." },
			"boat-winter": { ask: "Colder, like a winter night, with snow on the shore.", reply: "Colder now: snow on the hills and the shore, thin ice at the edges, a light snowfall." },
			"boat-dusk": { ask: "Go back to the morning one and make it dusk, for the “sync complete” screen.", reply: "The dusk version: the sun is down behind the hills, with a path of gold on the water." },
			"aurora-wide": { ask: "A background for the sign-in page: snowy mountains and a lake under the northern lights, 16:9.", reply: "Here it is: snowy peaks and pines under the northern lights, mirrored in the lake." },
			"aurora-tall": { ask: "Now a tall version, 9:16, for the splash screen on phones.", reply: "The tall version, 9:16, with the lights across the upper half." },
			icon: { ask: "An icon for orbit-cli: a planet with an orbit, with some depth to it. Give me two to pick from.", reply: "Both are here — pick the one you like and I'll keep refining it." },
		},
	},
};

export const BOAT_SESSION = "3c8e51d2-7a40-4b6f-9e21-5d0c8a4f1b70";
const AURORA_SESSION = "8f14b6a9-2d3e-4c57-a0b8-61e9d2c7f345";
const ICON_SESSION = "b27d90e4-5f18-46a3-8c2b-0e7a3d9f6c12";

/** The three conversations. */
export function drawingSessions(world: World, lang: Lang, art: Art): FixtureSession[] {
	const { titles, made: w } = words[lang];
	const at = (time: string, daysAgo = 0) => localMoment(world, time, daysAgo);
	const prompt = (key: Made) => w[key].prompt ?? art[key === "icon" ? "icon-a" : key].prompt;
	const image = (key: Exclude<Made, "icon">, when: number, input: Record<string, unknown>, from: ArtName[], tookMs: number): Exchange => ({
		at: when,
		ask: w[key].ask,
		input: { prompt: prompt(key), ...input },
		made: [art[key]],
		from: from.map((name) => art[name]),
		tookMs,
		reply: w[key].reply,
	});
	const boat: Exchange[] = [
		image("boat-day", at("16:05", 1), { aspect_ratio: "16:9" }, [], 18_400),
		image("boat-night", at("16:09", 1), { images: ["#1"], aspect_ratio: "16:9" }, ["boat-day"], 16_900),
		image("boat-winter", at("16:14", 1), { images: ["#1"], aspect_ratio: "16:9" }, ["boat-night"], 17_600),
		// Newest first, the morning picture is #3 by now: the winter one, the night one, then it.
		image("boat-dusk", at("10:21"), { images: ["#3"], aspect_ratio: "16:9" }, ["boat-day"], 15_800),
	];
	const aurora: Exchange[] = [
		image("aurora-wide", at("11:40"), { aspect_ratio: "16:9" }, [], 19_200),
		image("aurora-tall", at("11:47"), { images: ["#1"], aspect_ratio: "9:16" }, ["aurora-wide"], 17_300),
	];
	const icon: Exchange[] = [
		{
			at: at("15:32", 3),
			ask: w.icon.ask,
			input: { prompt: prompt("icon"), model: "grok-imagine-image-quality", aspect_ratio: "1:1", count: 2 },
			made: [art["icon-a"], art["icon-b"]],
			from: [],
			tookMs: 24_700,
			reply: w.icon.reply,
		},
	];
	const session = (id: string, project: string, title: string, exchanges: Exchange[]): FixtureSession => {
		const recorded = recordConversation(exchanges);
		return { id, project: world.project(project), title, at: Number(recorded.at(-1)?.timestamp), messages: [], modelId: "anthropic/claude-sonnet-5", recorded };
	};
	return [session(BOAT_SESSION, "aurora-notes", titles.boat, boat), session(AURORA_SESSION, "aurora-notes", titles.aurora, aurora), session(ICON_SESSION, "orbit-cli", titles.icon, icon)];
}
