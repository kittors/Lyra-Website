/**
 * The made-up machine the screenshots are taken on.
 *
 * Nothing in a published screenshot may come from the person running this: not their sessions, not
 * their paths, not their name. So the app is started with a HOME of its own — a temporary directory
 * holding a developer's `~/Projects` with four small but real repositories — and with its own
 * `LYRA_HOME` from Lyra's e2e harness. Paths the window shows are abbreviated against HOME, so they
 * read `~/Projects/aurora-notes`; the shell the terminal opens reads this HOME's `.zshrc`, whose
 * prompt names neither the user nor the host; git reads this HOME's `.gitconfig`.
 *
 * The projects are real on disk because the agent really works on them: `read` opens these files,
 * `edit` computes its diff against them, and the file panel lists and previews them.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

import type { Lang, ProjectSpec } from "../content/types.ts";
import { projectsFor } from "../content/projects.ts";

const run = promisify(execFile);

/** The fictional developer. */
export const PERSON = { name: "Maya Chen", email: "maya@aurora-notes.dev", login: "mayachen" } as const;

export interface Project {
	/** Directory name under `~/Projects`, and the name the sidebar shows. */
	name: string;
	path: string;
	id: string;
	branch: string;
}

export interface World {
	home: string;
	/** The fixed-offset zone the app runs in; see `afternoonZone`. */
	zone: string;
	projects: Project[];
	project(name: string): Project;
	dispose(): Promise<void>;
}

/** Lyra keys a project by the first 16 hex digits of the SHA-256 of its path. */
export function projectIdFor(path: string): string {
	return createHash("sha256").update(path).digest("hex").slice(0, 16);
}

/**
 * Git without the Xcode licence trap: when `xcode-select` points at a full Xcode whose licence was
 * never accepted, every git command exits 69. The Command Line Tools' git is not bound by it.
 */
function gitEnv(home: string, when?: string): NodeJS.ProcessEnv {
	const clt = "/Library/Developer/CommandLineTools";
	return {
		...process.env,
		HOME: home,
		GIT_CONFIG_NOSYSTEM: "1",
		...(existsSync(clt) ? { DEVELOPER_DIR: clt } : {}),
		...(when ? { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } : {}),
	};
}

async function put(root: string, files: Record<string, string>): Promise<void> {
	for (const [path, content] of Object.entries(files)) {
		const target = join(root, path);
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, content);
	}
}

/**
 * The fake test runner behind `npx vitest`.
 *
 * `npx` runs a package's local bin without printing anything of its own — `pnpm vitest` would first
 * run an install and print an update banner. The runner prints what Vitest prints, with the path
 * the developer's machine would show, then finishes — unless the hold flag exists, in which case it
 * waits before the last suite until the flag is removed: that is how a shot catches it mid-run.
 */
function fakeVitest(holdFlag: string, suites: { file: string; tests: number; ms: number }[]): string {
	return `#!/usr/bin/env node
const { existsSync } = require("node:fs");
const suites = ${JSON.stringify(suites)};
const hold = ${JSON.stringify(holdFlag)};
const out = (line) => process.stdout.write(line + "\\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv.slice(2).find((arg) => /^test\\//.test(arg));
// Colour only on a terminal, as Vitest does: the agent's bash tool gets plain text.
const tty = process.stdout.isTTY;
const paint = (code, text) => (tty ? "\\u001b[" + code + "m" + text + "\\u001b[0m" : text);
const shown = only ? suites.filter((suite) => suite.file.startsWith(only)) : suites;
(async () => {
	const started = new Date();
	out("");
	out(" " + (tty ? paint("44;1", " RUN ") : "RUN ") + " " + paint("36", "v3.2.4") + " " + paint("90", "/Users/${PERSON.login}/Projects/aurora-notes"));
	out("");
	for (const [index, suite] of shown.entries()) {
		await sleep(index === 0 ? 700 : 450);
		if (index === shown.length - 1) while (existsSync(hold)) await sleep(250);
		out(" " + paint("32", "\\u2713") + " " + suite.file + paint("90", " (" + suite.tests + " tests)") + " " + paint("33", suite.ms + "ms"));
	}
	const total = shown.reduce((n, s) => n + s.tests, 0);
	const pad = (n) => String(n).padStart(2, "0");
	out("");
	out(paint("90", " Test Files ") + " " + paint("32;1", shown.length + " passed") + paint("90", " (" + shown.length + ")"));
	out(paint("90", "      Tests ") + " " + paint("32;1", total + " passed") + paint("90", " (" + total + ")"));
	out(paint("90", "   Start at ") + " " + pad(started.getHours()) + ":" + pad(started.getMinutes()) + ":" + pad(started.getSeconds()));
	out(paint("90", "   Duration ") + " 612ms" + paint("90", " (transform 94ms, collect 171ms, tests 23ms)"));
	out("");
})();
`;
}

/**
 * A repository with its history, and a remote that looks like GitHub but is a bare repository in
 * the made-up home: `url.<dir>.insteadOf` in its `.gitconfig` rewrites the address, so fetches and
 * pushes work offline and nothing the app shows says "no remote".
 */
async function gitRepo(project: Project, home: string, spec: ProjectSpec): Promise<void> {
	const git = (args: string[], when?: string, cwd = project.path) => run("git", args, { cwd, env: gitEnv(home, when) });
	await git(["init", "-q", "-b", "main"]);
	for (const commit of spec.history) {
		await put(project.path, commit.files);
		await git(["add", "-A"]);
		await git(["commit", "-qm", commit.message], commit.when);
	}
	const bare = join(home, ".git-remotes", spec.owner, `${spec.name}.git`);
	await mkdir(dirname(bare), { recursive: true });
	await git(["init", "-q", "--bare", bare], undefined, home);
	await git(["remote", "add", "origin", `git@github.com:${spec.owner}/${spec.name}.git`]);
	await git(["push", "-q", "-u", "origin", "main"]);
	if (project.branch !== "main") {
		await git(["checkout", "-qb", project.branch]);
		await git(["push", "-q", "-u", "origin", project.branch]);
	}
}

/** Build the made-up HOME for one language. */
export async function buildWorld(lang: Lang): Promise<World> {
	// The real path: the terminal starts in the project's resolved path (`/private/var/...`), and zsh
	// only abbreviates `%~` when HOME is a prefix of it byte for byte.
	const root = await realpath(await mkdtemp(join(tmpdir(), "lyra-shots-")));
	const home = join(root, PERSON.login);
	await mkdir(home, { recursive: true });

	// `/etc/zshrc` sets PS1 to `%n@%m %1~ %#` — user and host. Skipping the global rc files is the
	// only way to keep them out; a PROMPT in the environment is overwritten by it.
	await writeFile(join(home, ".zshenv"), "unsetopt GLOBAL_RCS\nexport SHELL_SESSIONS_DISABLE=1\n");
	const zshrc = [
		"# A tidy prompt that says nothing about the machine it runs on.",
		"PROMPT='%F{cyan}%~%f %F{magenta}❯%f '",
		"RPROMPT=''",
		"unsetopt PROMPT_SP",
		"export LANG=en_US.UTF-8",
		"export CLICOLOR=1",
		"",
	].join("\n");
	await writeFile(join(home, ".zshrc"), zshrc);
	await writeFile(join(home, ".hushlogin"), "");
	// A fresh npm config would announce npm updates after every `npx`.
	await writeFile(join(home, ".npmrc"), "update-notifier=false\nfund=false\naudit=false\n");
	await writeFile(join(home, ".bash_profile"), "export PS1='\\W ❯ '\n");
	const specs = projectsFor(lang);
	const owners = [...new Set(specs.map((spec) => spec.owner))];
	await writeFile(
		join(home, ".gitconfig"),
		[
			`[user]\n\tname = ${PERSON.name}\n\temail = ${PERSON.email}`,
			"[init]\n\tdefaultBranch = main",
			"[advice]\n\tdetachedHead = false",
			"[push]\n\tautoSetupRemote = true",
			"[alias]\n\tlg = log --oneline --graph --decorate-refs=refs/heads",
			...owners.map((owner) => `[url "${join(home, ".git-remotes", owner)}/"]\n\tinsteadOf = git@github.com:${owner}/`),
			"",
		].join("\n"),
	);
	const projects: Project[] = [];
	for (const spec of specs) {
		const path = join(home, "Projects", spec.name);
		await mkdir(path, { recursive: true });
		const project: Project = { name: spec.name, path, id: projectIdFor(path), branch: spec.branch };
		await gitRepo(project, home, spec);
		// Work in progress on top of the last commit, so the tree is not suspiciously clean.
		await put(path, spec.working ?? {});
		if (spec.vitest) {
			const bin = join(path, "node_modules", ".bin");
			await mkdir(bin, { recursive: true });
			await writeFile(join(bin, "vitest"), fakeVitest(holdFlagFor(home), spec.vitest));
			await chmod(join(bin, "vitest"), 0o755);
			// `npx tsc` would otherwise go looking for TypeScript on the network. This one says what a
			// clean type check says — nothing — once the hold, if any, is lifted.
			await writeFile(
				join(bin, "tsc"),
				`#!/usr/bin/env node\nconst { existsSync } = require("node:fs");\nconst hold = ${JSON.stringify(holdFlagFor(home))};\n(async () => { await new Promise((r) => setTimeout(r, 900)); while (existsSync(hold)) await new Promise((r) => setTimeout(r, 250)); })();\n`,
			);
			await chmod(join(bin, "tsc"), 0o755);
		}
		projects.push(project);
	}

	return {
		home,
		zone: afternoonZone(),
		projects,
		project(name: string) {
			const found = projects.find((one) => one.name === name);
			if (!found) throw new Error(`no project called ${name}`);
			return found;
		},
		dispose: () => rm(root, { recursive: true, force: true }),
	};
}

/**
 * A fixed-offset zone in which it is early afternoon right now.
 *
 * Timestamps in the transcript read the clock, and a capture run at midnight would otherwise show
 * "今天 0:01" above every question. Nothing else depends on the zone: relative dates ("2 hours ago",
 * today, yesterday) are computed in it consistently.
 */
export function afternoonZone(now = new Date()): string {
	const offset = ((14 - now.getUTCHours() + 36) % 24) - 12;
	return offset >= 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`;
}

/** Hours east of UTC for an `Etc/GMT±N` zone (whose sign is the reverse of the usual). */
function zoneOffset(zone: string): number {
	const match = /^Etc\/GMT([+-])(\d+)$/.exec(zone);
	if (!match) return 0;
	return (match[1] === "-" ? 1 : -1) * Number(match[2]);
}

/** A wall-clock moment in the app's zone: `daysAgo` days before today, at `time` ("09:30"). */
export function localMoment(world: World, time: string, daysAgo = 0): number {
	const offset = zoneOffset(world.zone) * 3_600_000;
	const [hours, minutes] = time.split(":").map(Number);
	const local = new Date(Date.now() + offset);
	local.setUTCHours(hours, minutes, 0, 0);
	return local.getTime() - offset - daysAgo * 86_400_000;
}

/**
 * The environment the app is started with.
 *
 * `startApp` hands Electron a copy of this process's environment, so it is set here. HOME and
 * ZDOTDIR point at the made-up home; TZ puts the clock in the afternoon. What the person running the capture has in theirs — tokens of
 * the agent running this script, a base URL for Anthropic, terminal identifiers — is dropped: the
 * app, its shell and every command the agent runs would otherwise inherit it.
 */
export function enterWorld(world: World): () => void {
	const saved = { ...process.env };
	for (const key of Object.keys(process.env)) {
		if (/^(CLAUDE|ANTHROPIC|OPENAI|GEMINI|GOOGLE_API|DEEPSEEK|OPENROUTER|GITHUB_TOKEN|GH_TOKEN|API_TIMEOUT|TERM_PROGRAM|TERM_SESSION|ITERM|VSCODE|CURSOR|__CFBundle|SSH_AUTH_SOCK)/i.test(key)) delete process.env[key];
	}
	Object.assign(process.env, {
		TZ: world.zone,
		HOME: world.home,
		ZDOTDIR: world.home,
		SHELL: "/bin/zsh",
		USER: PERSON.login,
		LOGNAME: PERSON.login,
		LANG: "en_US.UTF-8",
	});
	return () => {
		for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
		Object.assign(process.env, saved);
	};
}

/**
 * Commit `files` in `project` on a new branch, and publish the branch — for scenes set later in the
 * project's story than the fixture's history.
 */
export async function commitOnBranch(world: World, project: Project, branch: string, message: string, files: Record<string, string>, when = new Date().toISOString()): Promise<void> {
	const git = (args: string[]) => run("git", args, { cwd: project.path, env: gitEnv(world.home, when) });
	await git(["checkout", "-qb", branch]);
	await put(project.path, files);
	await git(["add", "-A"]);
	await git(["commit", "-qm", message]);
	await git(["push", "-q", "-u", "origin", branch]);
	project.branch = branch;
}

/** Commit `files` on the project's current branch and push it — work already published. */
export async function commitAndPush(world: World, project: Project, message: string, files: Record<string, string>, when: string): Promise<void> {
	const git = (args: string[]) => run("git", args, { cwd: project.path, env: gitEnv(world.home, when) });
	await put(project.path, files);
	await git(["add", "-A"]);
	await git(["commit", "-qm", message]);
	await git(["push", "-q", "origin", project.branch]);
}

/** Outside every project, so no file tree or `git status` ever shows it. */
function holdFlagFor(home: string): string {
	return join(home, ".cache", "vitest-hold");
}

/** Hold the fake test runner before its last suite until the returned release is called. */
export async function holdVitest(world: World): Promise<() => Promise<void>> {
	const flag = holdFlagFor(world.home);
	await mkdir(dirname(flag), { recursive: true });
	await writeFile(flag, "");
	return () => rm(flag, { force: true });
}
