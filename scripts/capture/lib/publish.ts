/**
 * Moving chosen shots from `out/` to where they are used and looked at.
 */

import { copyFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import { SHOTS } from "./env.ts";

/** Read once, at start-up: scenes point HOME at the made-up machine while the app boots. */
const DESKTOP = join(homedir(), "Desktop", "官网测试", "截图");

export async function publish(files: string[]): Promise<void> {
	await mkdir(SHOTS, { recursive: true });
	await mkdir(DESKTOP, { recursive: true });
	for (const file of files) {
		await copyFile(file, join(SHOTS, basename(file)));
		await copyFile(file, join(DESKTOP, basename(file)));
	}
	if (files.length > 0) console.log(`   → ${files.length} 张放进 src/assets/shots/ 和 ~/Desktop/官网测试/截图/`);
}
