/**
 * `vault` — credentials: the card a conversation asks on, and the vault.
 *
 * In `atlas-api` the agent needs the staging server's deploy password and asks for it on a card above
 * the composer: what it is for in the model's words, then Lyra's own line on the kind and where it may
 * be used, the field, "save to vault", submit and decline. Then the vault, with one saved credential
 * of each kind, added the way the vault's own form adds them (`credentials.add`).
 */

import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sidebarSessions } from "../content/sessions.ts";
import type { Lang } from "../content/types.ts";
import { credentialAsk, credentialScript, savedCredentials } from "../content/vault.ts";
import { startConversation } from "../lib/converse.ts";
import { pause } from "../lib/env.ts";
import { startModel } from "../lib/model.ts";
import { writeSessions } from "../lib/sessions.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { shootBoth } from "../lib/shoot.ts";
import { openLyra } from "../lib/window.ts";
import { buildWorld, PERSON } from "../lib/world.ts";
import { REST } from "./hero.ts";

/** A key nobody has ever used: made for this run, gone with it. */
async function throwawayKey(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "vault-key-"));
	try {
		execFileSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", PERSON.email, "-f", join(dir, "key")]);
		return await readFile(join(dir, "key"), "utf8");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

export async function vaultScene(lang: Lang): Promise<string[]> {
	const world = await buildWorld(lang);
	const script = credentialScript(lang);
	const model = await startModel([script]);
	const win = await openLyra({
		world,
		lang,
		seed: async (home) => {
			await writeProfile(home, settingsFor({ world, lang, theme: "light", modelPort: model.port }));
			await writeSessions(home, sidebarSessions(world, lang));
		},
	});
	try {
		await startConversation(win, "atlas-api", credentialAsk(lang));
		await win.until(`document.querySelector('[data-ly-credential-card]')?.checkVisibility()`, 30_000, "凭据卡片");
		await pause(1500);
		const card = await shootBoth(win, "credential-card", REST);

		const key = await throwawayKey();
		for (const item of savedCredentials(lang, key)) {
			const added = await win.$<{ ok: boolean; problem?: string; message?: string }>(`window.lyra.credentials.add(${JSON.stringify(item)})`);
			if (!added.ok) throw new Error(`${String(item.name)} 存不进保险箱：${added.problem}${added.message ? ` ${added.message}` : ""}`);
		}
		await win.click('[data-ly-rail-item="vault"]');
		await win.until(`document.querySelectorAll('[data-ly-vault-row]').length === 4`, 15_000, "保险箱里的四项");
		await pause(1200);
		const vault = await shootBoth(win, "vault", REST);
		return [...card, ...vault];
	} catch (error) {
		console.log("   模型收到的：", model.log.map((entry) => entry.played).join(" → "));
		throw error;
	} finally {
		await win.close().catch(() => {});
		await model.close().catch(() => {});
		await world.dispose().catch(() => {});
	}
}
