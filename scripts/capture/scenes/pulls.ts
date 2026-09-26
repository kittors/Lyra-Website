/**
 * `pull-requests` — the Pull requests page, against a stand-in GitHub.
 *
 * The app has a GitHub account whose server is a GitHub Enterprise address on localhost. That server
 * answers the same three things github.com would: who the token belongs to (`/api/v3/user`), the
 * GraphQL search and detail queries (`/api/graphql`), and the diff (`/api/v3/repos/…/pulls/n`). The
 * page is then exactly what Lyra draws for a real account — review requests, your own pull requests,
 * checks, reviews, the conversation.
 *
 * Avatars: the renderer only loads remote images over https, so the stand-in's addresses are never
 * fetched; the faces are written into the avatar cache the page reads at start-up (identicons, drawn
 * in `content/pulls.ts`), and the page is reloaded once to pick them up.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { detailResponse, diffText, identicon, ME, PEOPLE, searchResponse } from "../content/pulls.ts";
import { sidebarSessions } from "../content/sessions.ts";
import type { Lang } from "../content/types.ts";
import { pause } from "../lib/env.ts";
import { writeSessions } from "../lib/sessions.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { shootBoth } from "../lib/shoot.ts";
import { openLyra } from "../lib/window.ts";
import { buildWorld, PERSON } from "../lib/world.ts";
import { REST } from "./hero.ts";

const ACCOUNT = "github-mayachen";

function standInGitHub(lang: Lang): Promise<{ port: number; close(): Promise<void> }> {
	const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
		let raw = "";
		req.on("data", (chunk) => (raw += chunk));
		req.on("end", () => {
			const path = (req.url ?? "").split("?")[0];
			const json = (status: number, body: unknown) => {
				res.writeHead(status, { "content-type": "application/json" });
				res.end(JSON.stringify(body));
			};
			if (req.method === "GET" && path === "/api/v3/user") {
				return json(200, { login: ME, name: PERSON.name, avatar_url: `https://avatars.example/${ME}` });
			}
			if (req.method === "POST" && path === "/api/graphql") {
				const { variables = {} } = JSON.parse(raw || "{}") as { variables?: Record<string, unknown> };
				if ("reviewing" in variables) return json(200, searchResponse());
				if ("owner" in variables) return json(200, detailResponse(lang, `${variables.owner}/${variables.name}`, Number(variables.number)));
				return json(200, { data: {} });
			}
			if (req.method === "GET" && /^\/api\/v3\/repos\/[^/]+\/[^/]+\/pulls\/\d+$/.test(path)) {
				res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
				res.end(diffText());
				return;
			}
			json(404, { message: "Not Found" });
		});
	});
	return new Promise((resolve) => {
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			const port = typeof address === "object" && address ? address.port : 0;
			resolve({
				port,
				close: () =>
					new Promise<void>((done) => {
						server.closeAllConnections?.();
						server.close(() => done());
						setTimeout(done, 1000);
					}),
			});
		});
	});
}

export async function pullsScene(lang: Lang): Promise<string[]> {
	const world = await buildWorld(lang);
	const github = await standInGitHub(lang);
	const win = await openLyra({
		world,
		lang,
		seed: async (home) => {
			await writeProfile(home, settingsFor({ world, lang, theme: "light" }));
			await writeSessions(home, sidebarSessions(world, lang));
			await mkdir(home, { recursive: true });
			await writeFile(
				join(home, "forges.json"),
				JSON.stringify({
					version: 1,
					entries: [
						{
							account: {
								id: ACCOUNT,
								kind: "github",
								label: "GitHub",
								baseUrl: `http://127.0.0.1:${github.port}`,
								login: ME,
								avatarUrl: null,
								addedAt: Date.now() - 40 * 86_400_000,
								enabled: true,
							},
							token: "EXAMPLE-TOKEN-not-a-real-one",
							encrypted: false,
						},
					],
				}),
			);
		},
	});
	try {
		// Faces into the avatar cache, then a reload so the page starts with them.
		const faces = PEOPLE.map((login) => [`${ACCOUNT}\u0000${login}`, identicon(login)]);
		await win.$(`(localStorage.setItem('lyra.avatars.v2', ${JSON.stringify(JSON.stringify(faces))}), true)`);
		await win.send("Page.reload", { ignoreCache: false });
		await pause(1500);
		await win.until(`document.querySelector('.ly-shell')`, 30_000, "重新载入后的界面");
		await pause(1000);
		await win.clickText(lang === "zh" ? "拉取请求" : "Pull requests");
		await win.until(`document.querySelectorAll('.ly-pr-row').length >= 6`, 30_000, "拉取请求列表");
		// The lead pull request, opened in the detail pane.
		const lead = await win.mark(`[...document.querySelectorAll('.ly-pr-row')].find((row) => row.innerText.includes('#142') || row.innerText.includes('merge per block'))`);
		await win.click(lead);
		await win.until(`(document.querySelector('[data-view="pull-requests"]')?.innerText ?? '').includes('Closes #137')`, 30_000, "详情加载");
		await pause(2000);
		return await shootBoth(win, "pull-requests", REST);
	} finally {
		await win.close().catch(() => {});
		await github.close().catch(() => {});
		await world.dispose().catch(() => {});
	}
}
