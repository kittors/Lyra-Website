/**
 * `mobile` — Lyra on a phone, paired with the desktop, in its touch interface.
 *
 *   mobile-1  a conversation started from the phone, stopped at an approval: the agent reworded a
 *             published commit and needs to force-push, and asks — the kind of thing you approve from
 *             your phone
 *   mobile-2  the sidebar, that same conversation held: lifted over a blurred page, its menu beside it
 *   mobile-3  a new conversation's empty screen: the mascot, the question, suggestions to swipe through
 *
 * `mobile-N-<light|dark>[-en].png`, like every other scene: the site looks a phone shot up by theme
 * first, and a bare `mobile-N.png` would lose to the dark one on a light page.
 *
 * The page keeps clear of the phone's status bar and home indicator itself (see `PHONE_SAFE`), so a
 * capture is the whole 390 × 844 screen and the website draws its chrome over the empty strips.
 */

import { FIXED_MERGE, MERGE_TEST } from "../content/hero.ts";
import { phoneAsk, phoneScript } from "../content/phone.ts";
import { sidebarSessions } from "../content/sessions.ts";
import type { Lang } from "../content/types.ts";
import { newConversationLabel, reached } from "../lib/converse.ts";
import { pause } from "../lib/env.ts";
import { freezeClock, thawClock } from "../lib/frame.ts";
import { startModel } from "../lib/model.ts";
import { openPhone, PHONE_REST, type PhoneWindow } from "../lib/phone.ts";
import { writeSessions } from "../lib/sessions.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { openLyra } from "../lib/window.ts";
import { buildWorld, commitAndPush } from "../lib/world.ts";

const SYNC = { port: 4596, token: "5c4e7a11d05e1f0e5e9c0de0000a11ce" };

/**
 * A light and a dark picture of the phone: `<name>-<theme>[-en].png`.
 *
 * `arrange` runs after each theme switch and before its picture, `after` once it is taken — for a
 * state that has to be made again in each theme rather than carried across the switch.
 */
async function pair(phone: PhoneWindow, name: string, arrange?: () => Promise<void>, after?: () => Promise<void>): Promise<string[]> {
	const suffix = phone.lang === "en" ? "-en" : "";
	await freezeClock(phone);
	try {
		const shots: Buffer[] = [];
		const words: string[] = [];
		for (const theme of ["light", "dark"] as const) {
			await phone.setAppearance({ theme });
			await arrange?.();
			shots.push(await phone.capture(PHONE_REST));
			words.push(await phone.words());
			await after?.();
		}
		if (words[0] !== words[1]) console.log(`   ${name}：深浅两张的文字不一致，检查一下`);
		return [await phone.save(`${name}-light${suffix}`, shots[0]!), await phone.save(`${name}-dark${suffix}`, shots[1]!)];
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
	const squash = phoneScript(lang);
	const model = await startModel([squash]);
	const desk = await openLyra({
		world,
		lang,
		seed: async (home) => {
			await writeProfile(home, settingsFor({ world, lang, theme: "light", modelPort: model.port, extra: { sync: { enabled: true, port: SYNC.port, token: SYNC.token } } }));
			await writeSessions(home, sidebarSessions(world, lang));
		},
	});
	let phone: PhoneWindow | undefined;
	const files: string[] = [];
	try {
		// The phone opens where the desktop is: leave the desktop on a fresh conversation in aurora-notes.
		await desk.click(`button[aria-label=${JSON.stringify(newConversationLabel(lang, "aurora-notes"))}]`);
		await pause(1200);
		phone = await openPhone(desk, world, SYNC.port, SYNC.token);
		const drawer = `button[aria-label*="${lang === "zh" ? "侧边栏" : "sidebar"}"]`;

		// mobile-3: the new conversation's empty screen, before anything is asked.
		await phone.until(`(document.querySelector('main')?.innerText ?? '').includes('aurora-notes')`, 10_000, "手机上的新对话");
		await pause(800);
		files.push(...(await pair(phone, "mobile-3")));

		// mobile-1: ask from the phone and let it run to its approval.
		await phone.tap("main textarea");
		await phone.until(`document.activeElement === document.querySelector('main textarea')`, 5_000, "输入框聚焦");
		await phone.type(phoneAsk(lang));
		await pause(400);
		await phone.tap(`button[aria-label="${lang === "zh" ? "发送" : "Send"}"]`);
		await reached(model, squash, squash.steps.length - 1);
		await phone.until(`document.querySelector('[data-approval-card]')`, 30_000, "手机上出现授权卡");
		await pause(1500);
		files.push(...(await pair(phone, "mobile-1")));

		// mobile-2: the drawer, and the conversation waiting on you held down. The press is made again
		// in each theme, so the lifted copy and the blur behind it are drawn in that theme.
		const held = `[...document.querySelectorAll('[data-ly-row]')].find((row) => !row.closest('.ly-lift') && row.innerText.includes(${JSON.stringify(squash.title)}))`;
		// On screen, not merely rendered: a closed drawer is moved off the left edge, and its rows still
		// report themselves visible.
		const onScreen = `(() => { const row = ${held}; if (!row) return false; const r = row.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1; })()`;
		const hold = async () => {
			if (!(await phone!.$<boolean>(onScreen))) {
				await phone!.tap(drawer);
				await phone!.until(onScreen, 5_000, "侧栏打开");
				await pause(900);
			}
			await phone!.longPress(await phone!.mark(held));
		};
		files.push(...(await pair(phone, "mobile-2", hold, () => phone!.dismissLift())));
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
