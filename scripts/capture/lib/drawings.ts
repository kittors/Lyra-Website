/**
 * Conversations in which pictures were drawn, written the way Lyra records them.
 *
 * The Studio is read from the store: every `image_generate` result in every conversation, each picture
 * known by its file in `session-media` (the SHA-1 of its bytes) and linked to the pictures that went
 * into it by the result's `sources`. So the scenes that show it seed finished conversations — a
 * person's words, the call the model made, the result with its details, the model's line after it —
 * rather than drawing live, which would put every picture under "today" and bill a model on every
 * run. The pictures themselves are real: made once by `art/generate.ts` with real image models, and
 * committed with what made them.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { ASSETS } from "./env.ts";
import { usageFor } from "./sessions.ts";

export interface Medium {
	/** The file's name in `session-media`. */
	media: string;
	mimeType: string;
	width: number;
	height: number;
	bytes: Buffer;
	/** The model and the prompt that really made it (`art/generate.ts`). */
	model: string;
	prompt: string;
}

const NAMES = ["boat-day", "boat-night", "boat-winter", "boat-dusk", "aurora-wide", "aurora-tall", "icon-a", "icon-b"] as const;
export type ArtName = (typeof NAMES)[number];
export type Art = Record<ArtName, Medium>;

interface Made {
	file: string;
	mimeType: string;
	width: number;
	height: number;
	model: string;
	prompt: string;
}

export async function loadArt(): Promise<Art> {
	const manifest = JSON.parse(await readFile(join(ASSETS, "manifest.json"), "utf8")) as Record<string, Made>;
	const art = {} as Art;
	for (const name of NAMES) {
		const made = manifest[name];
		if (!made) throw new Error(`scripts/capture/assets 里没有 ${name}：先跑 node scripts/capture/art/generate.ts`);
		const bytes = await readFile(join(ASSETS, made.file));
		const extension = made.file.split(".").pop();
		art[name] = { ...made, media: `${createHash("sha1").update(bytes).digest("hex")}.${extension}`, bytes };
	}
	return art;
}

/** Put the files where the window loads them from. */
export async function writeMedia(lyraHome: string, art: Art): Promise<void> {
	const dir = join(lyraHome, "session-media");
	await mkdir(dir, { recursive: true });
	for (const one of Object.values(art)) await writeFile(join(dir, one.media), one.bytes);
}

/** How each model is listed on the made-up machine: its id, the name the window shows, its provider. */
const MODELS: Record<string, { id: string; name: string; provider: string }> = {
	"gemini-3.1-flash-image": { id: "google/gemini-3.1-flash-image", name: "Gemini 3.1 Flash Image", provider: "Google" },
	"grok-imagine-image-quality": { id: "xai/grok-imagine-image-quality", name: "Grok Imagine Image Quality", provider: "xAI" },
	"grok-imagine-video-1.5": { id: "xai/grok-imagine-video-1.5", name: "Grok Imagine Video 1.5", provider: "xAI" },
};

/** One request: what the person said, the call it led to, what came back, and the model's line about it. */
export interface Exchange {
	/** When the person said it. */
	at: number;
	ask: string;
	/** The call's arguments as the model wrote them: `prompt`, `#1`-style references, ratio, count. */
	input: Record<string, unknown>;
	made: Medium[];
	/** The pictures that went in, in the order they were given. */
	from: Medium[];
	/** How long the image model took. */
	tookMs: number;
	reply: string;
}

const ASSISTANT = { api: "anthropic-messages", provider: "anthropic", model: "claude-sonnet-5" } as const;

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** The messages of one conversation, oldest first, each stamped with its time. */
export function recordConversation(exchanges: Exchange[]): Record<string, unknown>[] {
	const messages: Record<string, unknown>[] = [];
	exchanges.forEach((exchange, n) => {
		const callId = `toolu_${createHash("sha1").update(`${exchange.at}:${n}`).digest("hex").slice(0, 24)}`;
		const called = exchange.at + 2_800;
		const done = called + exchange.tookMs;
		const first = exchange.made[0];
		const model = MODELS[first.model];
		const paths = exchange.made.map((one) => `~/.lyra/session-media/${one.media}`).join(", ");
		const ratio = typeof exchange.input.aspect_ratio === "string" ? exchange.input.aspect_ratio : undefined;
		const details = {
			kind: "image_generation",
			status: "done",
			model,
			prompt: String(exchange.input.prompt),
			...(ratio ? { aspectRatio: ratio } : {}),
			count: exchange.made.length,
			edit: exchange.from.length > 0,
			...(exchange.from.length ? { sources: exchange.from.map((one) => one.media) } : {}),
			startedAt: called + 120,
			durationMs: exchange.tookMs,
			images: exchange.made.map(({ media, mimeType, width, height }) => ({ media, mimeType, width, height })),
		};
		const said = `Drew ${exchange.made.length} image${exchange.made.length === 1 ? "" : "s"} with ${model.name} (${first.width}×${first.height}) in ${seconds(exchange.tookMs)}; shown to the user in the conversation.\nSaved: ${paths}. To edit one, pass its path — or #1 for the newest image in the conversation — in \`images\`.`;
		messages.push(
			{ role: "user", content: [{ type: "text", text: exchange.ask }], timestamp: exchange.at },
			{
				role: "assistant",
				content: [{ type: "toolCall", id: callId, name: "image_generate", arguments: exchange.input }],
				...ASSISTANT,
				usage: usageFor(String(exchange.input.prompt)),
				stopReason: "toolUse",
				timestamp: called,
				durationMs: 2_600,
				sseDurationMs: 1_900,
			},
			{ role: "toolResult", toolCallId: callId, toolName: "image_generate", content: [{ type: "text", text: said }], details, isError: false, timestamp: done },
			{
				role: "assistant",
				content: [{ type: "text", text: exchange.reply }],
				...ASSISTANT,
				usage: usageFor(exchange.reply),
				stopReason: "stop",
				timestamp: done + 3_100,
				durationMs: 2_900,
				sseDurationMs: 2_200,
			},
		);
	});
	return messages;
}

/**
 * The image and video models, under providers of their own, as someone who makes pictures in Lyra has
 * them. `xai` moves xAI's endpoint, for a scene that has something on this machine answer as it.
 */
export function mediaProviders(xai = "https://api.x.ai/v1") {
	const model = (key: string) => {
		const { id, name } = MODELS[key];
		const [providerId, modelId] = id.split("/");
		return { id, providerId, modelId, name, contextWindow: 65_536, maxOutputTokens: 32_768, supportsThinking: false, supportsImages: true, supportsTools: false, metadataSource: "manual" };
	};
	return [
		{
			id: "google",
			name: "Google",
			api: "openai-chat-completions",
			baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
			apiKey: "EXAMPLE-KEY-0000000000000000",
			enabled: true,
			models: [model("gemini-3.1-flash-image")],
		},
		{
			id: "xai",
			name: "xAI",
			api: "openai-chat-completions",
			baseUrl: xai,
			apiKey: "xai-EXAMPLE-KEY-0000000000000000",
			enabled: true,
			models: [model("grok-imagine-image-quality"), model("grok-imagine-video-1.5")],
		},
	];
}

/** Settings additions for scenes that show made pictures: the two providers and the defaults. */
export function mediaSettings(settings: Record<string, unknown>, xai?: string): Record<string, unknown> {
	return {
		...settings,
		providers: [...(settings.providers as unknown[]), ...mediaProviders(xai)],
		imageModelId: MODELS["gemini-3.1-flash-image"].id,
		videoModelId: MODELS["grok-imagine-video-1.5"].id,
	};
}
