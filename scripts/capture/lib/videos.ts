/**
 * A video endpoint on this machine, standing in for xAI's.
 *
 * Lyra speaks xAI's video API to a model named `grok-imagine-video-*`: `POST /v1/videos/generations`
 * answers a request id, and `GET /v1/videos/{id}` is asked every few seconds until it says `done`.
 * This one never does — the scene shoots the clip while it is still being made, which is the state
 * the shot is about. Anything else gets a 404.
 */

import { createServer, type Server } from "node:http";

export interface VideoEndpoint {
	port: number;
	/** Every method and path asked for, in order. */
	seen: string[];
	close(): Promise<void>;
}

export async function startVideos(): Promise<VideoEndpoint> {
	const seen: string[] = [];
	const server: Server = createServer((req, res) => {
		const path = (req.url ?? "").replace(/\?.*$/, "");
		seen.push(`${req.method} ${path}`);
		// The body — a prompt and the first frame — says nothing these answers depend on.
		req.resume();
		req.on("end", () => {
			const json = (status: number, value: unknown) => {
				res.writeHead(status, { "content-type": "application/json" });
				res.end(JSON.stringify(value));
			};
			if (req.method === "POST" && path.endsWith("/videos/generations")) return json(200, { request_id: "vid-0001" });
			if (/\/videos\/vid-\d+$/.test(path)) return json(200, { status: "pending" });
			json(404, { error: { message: `not here: ${path}` } });
		});
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("video endpoint did not start");
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
