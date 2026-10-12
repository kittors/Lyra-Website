/**
 * Conversations for the sidebar and the quieter panes, seeded as Lyra's older session logs.
 *
 * Lyra keeps sessions in `sessions/sessions.db`. The first time it opens that database it imports the
 * logs it finds — append-only JSONL under `sessions/<projectId>/<id>.jsonl`, one record per line —
 * taking the sessions `sessions/index.json` lists, in its order and with its times. Lyra's own e2e
 * fixtures are seeded the same way. The outer `seq` starts at 1, as Lyra wrote it; the import
 * renumbers a record that is out of order rather than dropping it.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Project } from "./world.ts";

export interface FixtureMessage {
	role: "user" | "assistant";
	text: string;
}

export interface FixtureSession {
	id: string;
	project: Project;
	title: string;
	/** When the last message was written. The sidebar lists the most recent first. */
	at: number;
	messages: FixtureMessage[];
	modelId: string;
	archived?: boolean;
}

const ZERO = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };

function usageFor(text: string) {
	const output = Math.round(text.length / 1.6);
	const input = 4200 + text.length * 2;
	const cacheRead = 2600;
	const cost = { input: input * 3e-6, output: output * 15e-6, cacheRead: cacheRead * 0.3e-6, cacheWrite: 0, total: 0 };
	cost.total = cost.input + cost.output + cost.cacheRead;
	return { input, output, cacheRead, cacheWrite: 0, total: input + output + cacheRead, cost };
}

/** Write each session's log, and the index the sidebar reads before opening any of them. */
export async function writeSessions(lyraHome: string, sessions: FixtureSession[]): Promise<void> {
	const root = join(lyraHome, "sessions");
	const metas: Record<string, unknown>[] = [];
	for (const session of sessions) {
		const dir = join(root, session.project.id);
		await mkdir(dir, { recursive: true });
		const [provider, ...rest] = session.modelId.split("/");
		const model = rest.join("/");
		// Spread the exchange over the minutes before `at`, a minute or two per message.
		const start = session.at - session.messages.length * 95_000;
		const records: string[] = [];
		let seq = 0;
		const meta = {
			id: session.id,
			title: session.title,
			cwd: session.project.path,
			projectId: session.project.id,
			projectName: session.project.name,
			createdAt: start,
			updatedAt: session.at,
			modelId: session.modelId,
			thinking: "medium",
			messageCount: session.messages.length,
			usage: ZERO,
			seq: 0,
		};
		records.push(JSON.stringify({ seq: ++seq, ts: start, type: "meta", meta }));
		records.push(JSON.stringify({ seq: ++seq, ts: start, type: "title", title: session.title, source: "auto" }));
		session.messages.forEach((message, index) => {
			const ts = index === session.messages.length - 1 ? session.at : start + index * 95_000 + 30_000;
			const body =
				message.role === "user"
					? { role: "user", content: [{ type: "text", text: message.text }], timestamp: ts }
					: {
							role: "assistant",
							content: [{ type: "text", text: message.text }],
							api: "anthropic-messages",
							provider,
							model,
							usage: usageFor(message.text),
							stopReason: "stop",
							timestamp: ts,
							durationMs: 4000 + message.text.length * 18,
							sseDurationMs: 2500 + message.text.length * 15,
						};
			records.push(JSON.stringify({ seq: ++seq, ts, type: "message", message: body }));
		});
		if (session.archived) records.push(JSON.stringify({ seq: ++seq, ts: session.at, type: "archive", archived: true }));
		await writeFile(join(dir, `${session.id}.jsonl`), `${records.join("\n")}\n`);
		metas.push({ ...meta, seq, archived: session.archived ?? false });
	}
	await mkdir(root, { recursive: true });
	await writeFile(join(root, "index.json"), JSON.stringify(metas, null, 2));
}
