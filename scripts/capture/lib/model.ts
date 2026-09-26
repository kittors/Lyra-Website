/**
 * A model that follows a script, spoken over the Anthropic Messages streaming protocol.
 *
 * The screenshots show the real agent loop at work — real tool calls against a real (made-up)
 * project on disk, real diffs computed by Lyra's own edit tool, real command output — and the only
 * thing faked is the model deciding what to do next. That keeps every card, row and badge in the
 * picture exactly as the app draws it, without ever sending a byte to a real provider.
 *
 * Which step of a script to play is read from the request itself, never from a counter: the app also
 * asks the model for a session title, and it retries, so counting requests drifts. The step is the
 * number of assistant turns since the last thing a person actually said. The trailing `<env>` block
 * the runtime appends to every turn is not something a person said, and is skipped.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export interface ToolUse {
	name: string;
	input: Record<string, unknown>;
}

export interface Reply {
	thinking?: string;
	text?: string;
	tools?: ToolUse[];
	/** Milliseconds before the reply starts streaming. */
	delay?: number;
	/** Tokens per second the text streams at; the transcript shows the rate, so it should be believable. */
	rate?: number;
	/** Hold the reply until this resolves — for a turn that should still be "thinking" when shot. */
	hold?: Promise<void>;
}

export interface Script {
	/** Plays this script when the latest human message includes it. */
	cue: string;
	/** The session title the app asks for after the first message. */
	title?: string;
	steps: Reply[];
	/** What to say once the steps run out. */
	finally?: Reply;
}

/** What the request tells us about who is asking and where the conversation stands. */
export interface Heard {
	system: string;
	tools: string[];
	/** Every human message, oldest first, without the runtime's `<env>` block. */
	said: string[];
	/** Assistant turns since the last human message. */
	step: number;
	/** Tool results since the last human message. */
	results: number;
}

type Part = { type: string; text?: string; content?: unknown };
type Turn = { role: string; content: string | Part[] };

function human(turn: Turn): string | null {
	if (turn.role !== "user") return null;
	const parts: Part[] = typeof turn.content === "string" ? [{ type: "text", text: turn.content }] : turn.content;
	const words = parts
		.filter((part) => part.type === "text" && typeof part.text === "string")
		.map((part) => part.text as string)
		.filter((text) => !text.trimStart().startsWith("<env>") && !text.trimStart().startsWith("<system-reminder>"));
	if (words.length === 0) return null;
	return words.join("\n");
}

export function hear(body: { system?: unknown; tools?: { name: string }[]; messages?: Turn[] }): Heard {
	const messages = body.messages ?? [];
	const system = typeof body.system === "string" ? body.system : JSON.stringify(body.system ?? "");
	const said: string[] = [];
	let last = -1;
	messages.forEach((turn, index) => {
		const words = human(turn);
		if (words !== null) {
			said.push(words);
			last = index;
		}
	});
	const after = messages.slice(last + 1);
	const step = after.filter((turn) => turn.role === "assistant").length;
	const results = after
		.flatMap((turn) => (typeof turn.content === "string" ? [] : turn.content))
		.filter((part) => part.type === "tool_result").length;
	return { system, tools: (body.tools ?? []).map((tool) => tool.name), said, step, results };
}

/** Stream one reply the way Anthropic does: blocks opened, filled in pieces, closed. */
export async function stream(res: ServerResponse, reply: Reply): Promise<void> {
	if (reply.hold) await reply.hold;
	if (reply.delay) await new Promise((resolve) => setTimeout(resolve, reply.delay));
	res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
	const emit = (type: string, data: object) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
	const rate = reply.rate ?? 90;
	const chars = (reply.thinking?.length ?? 0) + (reply.text?.length ?? 0);
	// Roughly how a tokenizer counts mixed Chinese and English prose: about one token per 1.6 characters.
	const outputTokens = Math.max(24, Math.round(chars / 1.6) + (reply.tools?.length ?? 0) * 40);
	emit("message_start", {
		message: {
			id: `msg_${Math.random().toString(36).slice(2, 14)}`,
			type: "message",
			role: "assistant",
			content: [],
			model: "claude-sonnet-5",
			stop_reason: null,
			usage: { input_tokens: 5200, cache_read_input_tokens: 3100, output_tokens: 1 },
		},
	});
	let index = 0;
	const trickle = async (kind: "thinking" | "text", text: string) => {
		const pieces = text.match(/[\s\S]{1,14}/g) ?? [];
		// Spread the block over the time a model at `rate` would take to write it.
		const each = Math.max(4, Math.min(400, ((text.length / 1.6 / rate) * 1000) / Math.max(1, pieces.length)));
		for (const piece of pieces) {
			emit("content_block_delta", {
				index,
				delta: kind === "thinking" ? { type: "thinking_delta", thinking: piece } : { type: "text_delta", text: piece },
			});
			await new Promise((resolve) => setTimeout(resolve, each));
		}
	};
	if (reply.thinking) {
		emit("content_block_start", { index, content_block: { type: "thinking", thinking: "" } });
		await trickle("thinking", reply.thinking);
		emit("content_block_delta", { index, delta: { type: "signature_delta", signature: "c2NyaXB0ZWQ=" } });
		emit("content_block_stop", { index });
		index += 1;
	}
	if (reply.text) {
		emit("content_block_start", { index, content_block: { type: "text", text: "" } });
		await trickle("text", reply.text);
		emit("content_block_stop", { index });
		index += 1;
	}
	for (const tool of reply.tools ?? []) {
		emit("content_block_start", {
			index,
			content_block: { type: "tool_use", id: `toolu_${Math.random().toString(36).slice(2, 14)}`, name: tool.name, input: {} },
		});
		emit("content_block_delta", { index, delta: { type: "input_json_delta", partial_json: JSON.stringify(tool.input) } });
		emit("content_block_stop", { index });
		index += 1;
	}
	emit("message_delta", {
		delta: { stop_reason: (reply.tools?.length ?? 0) > 0 ? "tool_use" : "end_turn", stop_sequence: null },
		usage: { output_tokens: outputTokens },
	});
	emit("message_stop", {});
	res.end();
}

export interface ScriptedModel {
	port: number;
	/** Every request, in order, for diagnosing a script that went somewhere unexpected. */
	log: { heard: Heard; played: string }[];
	close(): Promise<void>;
}

/**
 * Start the model.
 *
 * `route` gets the first say — for requests that are not a scripted conversation at all, such as a
 * sub-agent's — and returns undefined to fall through to the scripts.
 */
export async function startModel(
	scripts: Script[],
	route?: (heard: Heard) => Reply | undefined,
): Promise<ScriptedModel> {
	const log: ScriptedModel["log"] = [];
	const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
		let raw = "";
		req.on("data", (chunk) => (raw += chunk));
		req.on("end", () => {
			let body: Parameters<typeof hear>[0];
			try {
				body = JSON.parse(raw);
			} catch {
				res.writeHead(400).end();
				return;
			}
			const heard = hear(body);
			const said = heard.said.at(-1) ?? "";
			const routed = route?.(heard);
			if (routed) {
				log.push({ heard, played: "route" });
				void stream(res, routed);
				return;
			}
			// No tools at all: the app naming the conversation, or another side request.
			if (heard.tools.length === 0) {
				const script = scripts.find((one) => heard.said.some((words) => words.includes(one.cue)) || heard.system.includes(one.cue));
				log.push({ heard, played: `title:${script?.cue ?? "?"}` });
				void stream(res, { text: script?.title ?? "新对话", rate: 400 });
				return;
			}
			const script = scripts.find((one) => said.includes(one.cue));
			if (!script) {
				log.push({ heard, played: "none" });
				void stream(res, { text: "好的。", rate: 200 });
				return;
			}
			const reply = script.steps[heard.step] ?? script.finally ?? { text: "好的。" };
			log.push({ heard, played: `${script.cue}#${heard.step}` });
			void stream(res, reply);
		});
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("scripted model did not start");
	return {
		port: address.port,
		log,
		close: () =>
			new Promise<void>((resolve) => {
				server.closeAllConnections?.();
				server.close(() => resolve());
				setTimeout(resolve, 1500);
			}),
	};
}
