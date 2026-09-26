/**
 * `mobile` — Lyra on a phone, paired with the desktop.
 *
 *   mobile-1  a conversation started from the phone, stopped at an approval: the agent reworded a
 *             published commit and needs to force-push, and asks — the kind of thing you approve from
 *             your phone
 *   mobile-2  the sidebar: projects and conversations, the one waiting on you marked
 *   mobile-3  a finished conversation from the desktop, read on the phone: the answer and the files
 *             it changed
 *
 * `mobile-N-light.png` and `mobile-N-dark.png` (with `-en` for the English interface), like every
 * other scene: the site looks a phone shot up by theme first, and a bare `mobile-N.png` would lose to
 * the dark one on a light page.
 */

import { atlasAsk, atlasScript } from "../content/atlas.ts";
import { FIXED_MERGE, MERGE_TEST } from "../content/hero.ts";
import { phoneAsk, phoneScript } from "../content/phone.ts";
import { sidebarSessions } from "../content/sessions.ts";
import type { Lang } from "../content/types.ts";
import { finished, newConversationLabel, reached, startConversation } from "../lib/converse.ts";
import { pause } from "../lib/env.ts";
import { freezeClock, scrollTo, thawClock } from "../lib/frame.ts";
import { startModel } from "../lib/model.ts";
import { openPhone, PHONE_REST, type PhoneWindow } from "../lib/phone.ts";
import { writeSessions } from "../lib/sessions.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { openLyra } from "../lib/window.ts";
import { buildWorld, commitAndPush } from "../lib/world.ts";

const SYNC = { port: 4596, token: "5c4e7a11d05e1f0e5e9c0de0000a11ce" };

/** A light and a dark picture of the phone as it is now: `<name>-<theme>[-en].png`. */
async function pair(phone: PhoneWindow, name: string): Promise<string[]> {
	const suffix = phone.lang === "en" ? "-en" : "";
	await freezeClock(phone);
	try {
		await phone.setAppearance({ theme: "light" });
		const light = await phone.capture(PHONE_REST);
		const lightWords = await phone.words();
		await phone.setAppearance({ theme: "dark" });
		const dark = await phone.capture(PHONE_REST);
		if ((await phone.words()) !== lightWords) console.log(`   ${name}：深浅两张的文字不一致，检查一下`);
		return [await phone.save(`${name}-light${suffix}`, light), await phone.save(`${name}-dark${suffix}`, dark)];
	} finally {
		await thawClock(phone).catch(() => {});
		await phone.setAppearance({ theme: "light" }).catch(() => {});
	}
}

export async function mobileScene(lang: Lang): Promise<string[]> {
	const world = await buildWorld(lang);
	const aurora = world.project("aurora-notes");
	// The fix, then its tests under a throwaway message — both already on the remote, so rewording the
	// last one will need a force push.
	await commitAndPush(world, aurora, "fix(sync): merge per block, ordered by hybrid clock", { "src/sync/merge.ts": FIXED_MERGE }, "2026-09-25T18:12:00+08:00");
	await commitAndPush(world, aurora, "wip tests", { "test/sync/merge.test.ts": MERGE_TEST }, "2026-09-25T18:47:00+08:00");
	const atlas = atlasScript(lang);
	const squash = phoneScript(lang);
	const model = await startModel([atlas, squash]);
	const desk = await openLyra({
		world,
		lang,
		seed: async (home) => {
			const settings = settingsFor({ world, lang, theme: "light", modelPort: model.port, extra: { sync: { enabled: true, port: SYNC.port, token: SYNC.token } } });
			// The phone's composer has room for about eight characters of model name: "Claude Sonnet 5"
			// would be cut to "Claude So…". The mark still comes from the name, so it stays Claude's.
			const anthropic = (settings.providers as { id: string; models: { modelId: string; name: string }[] }[]).find((provider) => provider.id === "anthropic");
			const sonnet = anthropic?.models.find((one) => one.modelId === "claude-sonnet-5");
			if (sonnet) sonnet.name = "Sonnet 5";
			await writeProfile(home, settings);
			await writeSessions(home, sidebarSessions(world, lang).filter((session) => session.project.name !== "atlas-api" || !session.title.includes("/v2/search")));
		},
	});
	let phone: PhoneWindow | undefined;
	const files: string[] = [];
	try {
		// A finished conversation, from the desktop, for the phone to read later.
		await startConversation(desk, "atlas-api", atlasAsk(lang));
		await finished(desk, model, atlas);
		// The phone opens where the desktop is; leave the desktop on a fresh conversation in aurora-notes.
		await desk.click(`button[aria-label=${JSON.stringify(newConversationLabel(lang, "aurora-notes"))}]`);
		await pause(1200);

		phone = await openPhone(desk, world, SYNC.port, SYNC.token);
		const drawer = `button[aria-label*="${lang === "zh" ? "侧边栏" : "sidebar"}"]`;

		// mobile-1: start a conversation on the phone — it opens on a fresh one in aurora-notes — and
		// let it run to its approval.
		await phone.until(`(document.querySelector('main')?.innerText ?? '').includes('aurora-notes')`, 10_000, "手机上的新对话");
		await phone.tap("main textarea");
		await phone.until(`document.activeElement === document.querySelector('main textarea')`, 5_000, "输入框聚焦");
		await phone.type(phoneAsk(lang));
		await pause(400);
		await phone.tap(`button[aria-label="${lang === "zh" ? "发送" : "Send"}"]`);
		await reached(model, squash, squash.steps.length - 1);
		await phone.until(`document.querySelector('[data-approval-card]')`, 30_000, "手机上出现授权卡");
		await pause(1500);
		files.push(...(await pair(phone, "mobile-1")));

		// mobile-2: the sidebar, with that conversation waiting on you.
		await phone.tap(drawer);
		await pause(1200);
		files.push(...(await pair(phone, "mobile-2")));

		// mobile-3: the finished conversation from the desktop.
		const row = await phone.mark(`[...document.querySelectorAll('[data-ly-row]')].find((r) => r.innerText.includes(${JSON.stringify(atlas.title)}))?.querySelector('button')`);
		await phone.tap(row);
		await phone.until(`(document.querySelector('main')?.innerText ?? '').includes('ratelimit')`, 15_000, "打开已完成的对话");
		await pause(1200);
		// The question at the top, whole; the answer runs on under the composer.
		const question = await phone.mark(
			`[...document.querySelectorAll('main *')].find((el) => el.childElementCount === 0 && (el.textContent || '').startsWith(${JSON.stringify(atlasAsk(lang).slice(0, 8))}))`,
			"data-shot-question",
		);
		await scrollTo(phone, question, 78, { x: 195, y: 420 });
		// The scrollbar shows while scrolling and fades a moment later.
		await pause(2800);
		files.push(...(await pair(phone, "mobile-3")));
		return files;
	} catch (error) {
		console.log("   模型收到的：", model.log.map((entry) => entry.played).join(" → "));
		if (phone) console.log("   手机上：", await phone.describe());
		throw error;
	} finally {
		await phone?.close().catch(() => {});
		await desk.close().catch(() => {});
		await model.close().catch(() => {});
		await world.dispose().catch(() => {});
	}
}
