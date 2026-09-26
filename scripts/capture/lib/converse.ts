/**
 * Starting a conversation the way a person does — the project's own "new conversation" button, the
 * composer, Enter — and waiting on the scripted model rather than on the clock.
 */

import type { Lang } from "../content/types.ts";
import { pause } from "./env.ts";
import type { Script, ScriptedModel } from "./model.ts";
import type { LyraWindow } from "./window.ts";

export function newConversationLabel(lang: Lang, project: string): string {
	return lang === "zh" ? `在「${project}」里新建会话` : `New conversation in “${project}”`;
}

/** Open a fresh conversation in `project` and send `ask` from its composer. */
export async function startConversation(win: LyraWindow, project: string, ask: string): Promise<void> {
	await win.click(`button[aria-label=${JSON.stringify(newConversationLabel(win.lang, project))}]`);
	await win.until(`document.querySelector("main textarea") && document.activeElement === document.querySelector("main textarea") || document.querySelector("main textarea")`, 10_000);
	await pause(400);
	await win.click("main textarea");
	await win.type(ask);
	await pause(250);
	await win.key("Enter", "Enter", 13);
}

/** Wait until the model has been asked for step `step` of `script`. */
export async function reached(model: ScriptedModel, script: Script, step: number, ms = 90_000): Promise<void> {
	const deadline = Date.now() + ms;
	const mark = `${script.cue}#${step}`;
	while (!model.log.some((entry) => entry.played === mark)) {
		if (Date.now() > deadline) {
			throw new Error(`模型没走到 ${mark}；走过的：${model.log.map((entry) => entry.played).join(" → ")}`);
		}
		await pause(200);
	}
}

/** Wait for a script to play its last step and the turn to settle in the window. */
export async function finished(win: LyraWindow, model: ScriptedModel, script: Script): Promise<void> {
	await reached(model, script, script.steps.length - 1);
	await win.until(`!document.querySelector('[data-ly-run="running"]') && !document.querySelector('[data-ly-turn-process="running"]')`, 30_000, "这一轮收尾");
	await pause(1500);
}
