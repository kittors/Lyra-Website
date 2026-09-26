/**
 * `workspace-panels` — the built-in terminal beside a conversation.
 *
 * The conversation is the one about Tab moving between table cells; beside it, the project's shell
 * with the branch's history and the whole test suite run. The shell is the made-up home's zsh, whose
 * prompt shows the working directory and nothing about the machine.
 */

import { sidebarSessions } from "../content/sessions.ts";
import type { Lang } from "../content/types.ts";
import { pause } from "../lib/env.ts";
import { dragSeparator } from "../lib/frame.ts";
import { writeSessions } from "../lib/sessions.ts";
import { settingsFor, writeProfile } from "../lib/settings.ts";
import { shootBoth } from "../lib/shoot.ts";
import { openLyra } from "../lib/window.ts";
import { buildWorld } from "../lib/world.ts";
import { REST } from "./hero.ts";

export async function workspaceScene(lang: Lang): Promise<string[]> {
	const world = await buildWorld(lang);
	const win = await openLyra({
		world,
		lang,
		seed: async (home) => {
			await writeProfile(home, settingsFor({ world, lang, theme: "light" }));
			await writeSessions(home, sidebarSessions(world, lang));
		},
	});
	try {
		const row = await win.mark(`[...document.querySelectorAll('[data-ly-row]')].find((r) => r.innerText.includes(${JSON.stringify(lang === "zh" ? "表格里用 Tab" : "Tab through table cells")}))?.querySelector('button')`);
		await win.click(row);
		await pause(1200);
		await win.click(`button[aria-label^="${lang === "zh" ? "终端" : "Terminal"}"]`);
		await win.until(`document.querySelector('[data-dock-pane="terminal"] [data-terminal-id]')`, 20_000, "终端面板");
		const width = await win.$<number>(`document.querySelector('[data-dock-pane="terminal"]').getBoundingClientRect().width`);
		await dragSeparator(win, `[data-dock-panes] [role=separator][aria-orientation=vertical]`, width - 600);
		await pause(1500);
		const id = await win.$<string>(`document.querySelector('[data-dock-pane="terminal"] [data-terminal-id]').dataset.terminalId`);
		const run = async (command: string, wait: number) => {
			await win.$(`(window.lyra.terminal.write(${JSON.stringify(id)}, ${JSON.stringify(`${command}\r`)}), true)`);
			await pause(wait);
		};
		await run("clear", 700);
		await run("git lg -5", 1500);
		await run("npx vitest run", 5000);
		await win.until(`(document.querySelector('[data-dock-pane="terminal"]')?.innerText ?? '').includes('Duration')`, 15_000, "测试跑完");
		await pause(800);
		/*
		 * The terminal reads the theme from the page (the \`dark\` class, \`--ly-code-bg\`), which the app
		 * updates after the terminal has already re-themed — so a theme switch leaves it one theme
		 * behind. Saving the settings once more, unchanged, re-runs it against the updated page.
		 */
		return await shootBoth(win, "workspace-panels", REST, async () => {
			await win.setAppearance({});
			await pause(600);
		});
	} finally {
		await win.close().catch(() => {});
		await world.dispose().catch(() => {});
	}
}
