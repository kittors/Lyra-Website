/**
 * An image endpoint on this machine, standing in for the image model's provider.
 *
 * Lyra sends an `image_generate` call over OpenAI's Images API: `/v1/images/generations`, and
 * `/v1/images/edits` when the drawing starts from another picture. Each is answered with a fixed
 * picture after `drawMs` — an edit not before `holdEdits` resolves, for a drawing that should still
 * be under way when it is shot. Anything else gets a 404, which Lyra reads as "not an Images host".
 */

import { createServer, type Server } from "node:http";

import { pause } from "./env.ts";

export interface ImageEndpoint {
	port: number;
	/** Every path asked for, in order. */
	seen: string[];
	close(): Promise<void>;
}

export async function startImages(options: {
	generations: Buffer;
	edits: Buffer;
	drawMs: number;
	holdEdits?: Promise<void>;
}): Promise<ImageEndpoint> {
	const seen: string[] = [];
	const server: Server = createServer((req, res) => {
		const path = (req.url ?? "").replace(/\?.*$/, "");
		seen.push(path);
		// The body (a prompt, and the pictures for an edit) says nothing this answer depends on.
		req.resume();
		req.on("end", async () => {
			const edit = path.endsWith("/images/edits");
			if (!edit && !path.endsWith("/images/generations")) {
				res.writeHead(404, { "content-type": "application/json" });
				res.end(JSON.stringify({ error: { message: `not here: ${path}` } }));
				return;
			}
			await pause(options.drawMs);
			if (edit && options.holdEdits) await options.holdEdits;
			if (res.destroyed) return;
			res.writeHead(200, { "content-type": "application/json" });
			res.end(
				JSON.stringify({
					created: Math.floor(Date.now() / 1000),
					data: [{ b64_json: (edit ? options.edits : options.generations).toString("base64") }],
					usage: { input_tokens: 37, output_tokens: 1290, total_tokens: 1327 },
				}),
			);
		});
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("image endpoint did not start");
	return {
		port: address.port,
		seen,
		close: () =>
			new Promise<void>((resolve) => {
				server.closeAllConnections?.();
				server.close(() => resolve());
				setTimeout(resolve, 1500);
			}),
	};
}
