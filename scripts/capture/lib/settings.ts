/**
 * The made-up machine's `settings.json`.
 *
 * Providers carry the names, endpoints and models a developer would really have configured, taken
 * from Lyra's own model catalogue so the context windows and prices are the real ones. Every key is
 * an obvious placeholder; the settings page shows it as dots in any case. Only the provider that the
 * scripted model stands in for points at localhost, and only in scenes where a conversation runs —
 * the settings shot shows the public endpoint.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { UI_LOCALE, type Lang } from "../content/types.ts";
import type { Theme } from "./window.ts";
import type { World } from "./world.ts";

export const MARKET = "https://market.07230805.xyz/v1/index";

type Model = [id: string, name: string, context: number, output: number, input$: number, output$: number, images?: boolean];

function models(providerId: string, list: Model[]) {
	return list.map(([modelId, name, contextWindow, maxOutputTokens, input, output, images = true]) => ({
		id: `${providerId}/${modelId}`,
		providerId,
		modelId,
		name,
		contextWindow,
		maxOutputTokens,
		supportsThinking: true,
		supportsImages: images,
		supportsTools: true,
		pricing: { input, output },
		// Not "catalog": a catalogue-following model on an endpoint the catalogue does not recognise —
		// the scripted model on localhost — has its display name reset to its id.
		metadataSource: "manual",
	}));
}

export function providers(anthropicUrl = "https://api.anthropic.com") {
	return [
		{
			id: "anthropic",
			name: "Anthropic",
			api: "anthropic-messages",
			baseUrl: anthropicUrl,
			apiKey: "sk-ant-EXAMPLE-KEY-0000000000000000",
			enabled: true,
			models: models("anthropic", [
				["claude-sonnet-5", "Claude Sonnet 5", 1_000_000, 128_000, 2, 10],
				["claude-opus-5", "Claude Opus 5", 1_000_000, 128_000, 5, 25],
				["claude-haiku-4-5", "Claude Haiku 4.5", 200_000, 64_000, 1, 5],
			]),
		},
		{
			id: "openai",
			name: "OpenAI",
			api: "openai-responses",
			baseUrl: "https://api.openai.com/v1",
			apiKey: "sk-proj-EXAMPLE-KEY-0000000000000000",
			enabled: true,
			models: models("openai", [
				["gpt-5.6", "GPT-5.6", 1_050_000, 128_000, 4, 20],
				["gpt-5.5", "GPT-5.5", 1_050_000, 128_000, 5, 30],
				["gpt-5.6-luna", "GPT-5.6 Luna", 1_050_000, 128_000, 0.2, 1.2],
			]),
		},
		{
			id: "openrouter",
			name: "OpenRouter",
			api: "openai-responses",
			baseUrl: "https://openrouter.ai/api/v1",
			apiKey: "sk-or-EXAMPLE-KEY-0000000000000000",
			enabled: true,
			models: models("openrouter", [
				["anthropic/claude-opus-5", "Claude Opus 5", 1_000_000, 128_000, 5, 25],
				["openai/gpt-5.6", "GPT-5.6", 1_050_000, 128_000, 4, 20],
				["google/gemini-3.5-flash", "Gemini 3.5 Flash", 1_048_576, 65_536, 1.5, 9],
				["moonshotai/kimi-k3", "Kimi K3", 1_048_576, 262_144, 3, 15],
				["qwen/qwen3.8-max-0902", "Qwen3.8 Max 0902", 1_000_000, 131_072, 2, 6],
			]),
		},
		{
			id: "deepseek",
			name: "DeepSeek",
			api: "anthropic-messages",
			baseUrl: "https://api.deepseek.com/anthropic",
			apiKey: "sk-EXAMPLE-KEY-0000000000000000",
			enabled: true,
			models: models("deepseek", [
				["deepseek-v4-pro", "DeepSeek V4 Pro", 1_000_000, 384_000, 0.435, 0.87, false],
				["deepseek-v4-flash", "DeepSeek V4 Flash", 1_000_000, 384_000, 0.14, 0.28, false],
			]),
		},
		{
			id: "moonshot",
			name: "Moonshot AI",
			api: "anthropic-messages",
			baseUrl: "https://api.moonshot.ai/anthropic",
			apiKey: "sk-EXAMPLE-KEY-0000000000000000",
			enabled: true,
			models: models("moonshot", [["kimi-k3", "Kimi K3", 1_048_576, 262_144, 3, 15]]),
		},
	];
}

export interface SettingsOptions {
	world: World;
	lang: Lang;
	theme: Theme;
	/** Port of the scripted model, when a conversation will run. */
	modelPort?: number;
	/**
	 * Which providers are configured. The sidebar's footer names every enabled one and truncates at
	 * two; the conversation scenes carry Anthropic alone, the settings scene all five.
	 */
	providerSet?: "core" | "all";
	extra?: Record<string, unknown>;
}

export function settingsFor({ world, lang, theme, modelPort, providerSet = "core", extra = {} }: SettingsOptions): Record<string, unknown> {
	const now = Date.now();
	const all = providers(modelPort ? `http://127.0.0.1:${modelPort}` : undefined);
	return {
		version: 1,
		uiLocale: UI_LOCALE[lang],
		providers: providerSet === "all" ? all : all.filter((provider) => provider.id === "anthropic"),
		defaultModelId: "anthropic/claude-sonnet-5",
		mcpServers: [],
		// Most recently opened first; the sidebar lists projects in this order.
		projects: world.projects.map((project, index) => ({
			id: project.id,
			name: project.name,
			path: project.path,
			pinned: false,
			lastOpenedAt: now - index * 3_600_000,
		})),
		permissionMode: "auto",
		thinking: "medium",
		retryAttempts: 0,
		autoSummarizeTitle: true,
		memoryExtraction: false,
		autoUpdatePlugins: false,
		hooks: [],
		scheduledTasks: [],
		disabledPlugins: [],
		pluginRegistries: [MARKET],
		skillRegistries: [`${MARKET}?kind=skill`],
		alwaysAllow: [],
		sync: { enabled: false, port: 4517, token: null },
		appearance: { theme, reduceMotion: "off" },
		...extra,
	};
}

/** Write settings.json and the window's size and place into Lyra's profile. */
export async function writeProfile(lyraHome: string, settings: Record<string, unknown>): Promise<void> {
	await mkdir(lyraHome, { recursive: true });
	await writeFile(join(lyraHome, "settings.json"), JSON.stringify(settings, null, 2));
	await writeFile(join(lyraHome, "window.json"), JSON.stringify({ width: 1440, height: 900, x: 0, y: 0 }));
}
