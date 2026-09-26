import { Hono } from "hono";

export interface Env {
	ASSETS: Fetcher;
	RELEASES: R2Bucket;
	REPOSITORY: string;
	MIRROR_ORIGIN: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (context) => context.json({ ok: true }));

export default {
	fetch: app.fetch,
} satisfies ExportedHandler<Env>;
