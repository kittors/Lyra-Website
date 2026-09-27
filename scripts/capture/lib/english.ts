/**
 * Stand-ins for the English interface, in the places where Lyra still prints Chinese.
 *
 * Each one is a gap in Lyra's own localisation, reported and waiting for a fix there. Until then the
 * English screenshots show what the localised app would. They change only how the page renders,
 * never Lyra's files, and only in English runs. `SHOTS_NO_EN_FIXES=1` turns them all off; drop each
 * one once Lyra fixes it.
 *
 *  1. Message times. `formatSentAt` in `features/conversation/MessageActions.tsx` formats with a
 *     hard-coded "zh-CN", so every message says "9月26日 14:28" whatever the language. The phone shows
 *     it (a touch screen has no hover to hide it behind). A "zh-CN" argument to Date's locale methods
 *     becomes "en" here, which is what passing the interface's locale would do.
 *  2. Terminal tabs. `electron/terminal-registry.ts` names every terminal "终端 N"; the main
 *     process's own catalogue (`electron/i18n.ts`) has no entry for it.
 *  3. Approval reasons. The risk explanations in `core/src/tools/risk.ts` are Chinese only; the one
 *     a force push carries is translated. The approval card prints it in the same text node as the
 *     command, so it is replaced as a phrase, not matched as a whole node.
 *  4. Tool summaries. `lib/tool-kinds.ts` joins the parts of a run with "、", in English too.
 *  5. The approval card's header on a phone. In `features/conversation/ApprovalOverlay.tsx` the kind
 *     label ("Run a command") and the countdown ("Expires in 4:58") never shrink, and on a 390 pt
 *     screen in English they leave the title about 60 pt, where `break-words` splits "command" into
 *     "comma" / "nd". The kind label says what the title already says, so on the phone it is hidden
 *     and the title fits on one line. Scoped to the phone host; the desktop is untouched.
 *
 * Installed for every document the target loads, so a reload keeps them, and run once for the
 * document already there. A mutation observer re-applies them as the page renders.
 */

import type { Grabber } from "./env.ts";

/** Runs in the page. A plain string: no backticks, no interpolation. */
const STAND_INS = String.raw`(() => {
	if (window.__shotEnglish) return true;
	window.__shotEnglish = true;
	for (const name of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]) {
		const real = Date.prototype[name];
		Date.prototype[name] = function (locales, options) {
			return real.call(this, locales === "zh-CN" ? "en" : locales, options);
		};
	}
	const reasons = {
		"强制推送会覆盖远程历史": "A force push overwrites the remote history",
	};
	const fix = (node) => {
		const text = node.nodeValue;
		if (!text) return;
		let next = text;
		const tab = /^(\s*)终端 (\d+)(\s*)$/.exec(text);
		if (tab) next = tab[1] + "Terminal " + tab[2] + tab[3];
		for (const reason in reasons) if (next.includes(reason)) next = next.split(reason).join(reasons[reason]);
		if (next.includes("、") && node.parentElement && node.parentElement.closest(".ly-flow-summary")) next = next.split("、").join(", ");
		if (next !== text) node.nodeValue = next;
	};
	const sweep = (root) => {
		if (root.nodeType === Node.TEXT_NODE) return fix(root);
		if (root.nodeType !== Node.ELEMENT_NODE) return;
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) fix(node);
	};
	new MutationObserver((records) => {
		for (const record of records) {
			if (record.type === "characterData") fix(record.target);
			else record.addedNodes.forEach(sweep);
		}
	}).observe(document, { subtree: true, childList: true, characterData: true });
	if (document.body) sweep(document.body);
	const style = document.createElement("style");
	style.textContent = '[data-lyra-host="mobile"] [data-approval-card] [data-ly-avatar-host] > span.shrink-0.text-caption.text-ink-faint:not(.tabular-nums) { display: none; }';
	(document.head || document.documentElement).appendChild(style);
	return true;
})()`;

/** Install the stand-ins in a window's page (the desktop's main window, or the phone). */
export async function installEnglishStandIns(grab: Grabber): Promise<void> {
	if (process.env.SHOTS_NO_EN_FIXES) return;
	await grab.send("Page.addScriptToEvaluateOnNewDocument", { source: STAND_INS });
	await grab.evaluate(STAND_INS);
}
