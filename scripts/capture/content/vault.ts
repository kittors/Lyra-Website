/**
 * The credentials shots: a card asking for a password in `atlas-api`, and the vault with four saved.
 *
 * The staging server's disk is filling up; to look, the agent needs the deploy account's password and
 * asks for it on a card — the value goes to Lyra, the model only ever gets the name. The vault holds
 * one credential of each kind. Every value is a placeholder, and the vault never shows one anyway;
 * the SSH key is made fresh for each run and thrown away with it.
 */

import type { Script } from "../lib/model.ts";
import type { Lang } from "./types.ts";

const words = {
	zh: {
		ask: "atlas-api 的 staging 服务器磁盘快满了，登上去看看是什么占的空间。",
		title: "staging 服务器磁盘快满了",
		lead: "要先登上 staging 服务器。我向你要一下 deploy 账号的密码——它只交给 Lyra，我这边拿到的只是一个名字。",
		card: { title: "staging 服务器的 deploy 密码", purpose: "登录 staging 服务器，用 df 和 du 找出是哪些目录占满了磁盘。" },
		saved: {
			staging: "staging 服务器的 deploy 密码",
			github: "GitHub 发版令牌",
			npm: "npm 发布账号",
			deploy: "aurora-notes 部署密钥",
		},
	},
	en: {
		ask: "The atlas-api staging server is almost out of disk. Log in and see what is taking the space.",
		title: "Staging server out of disk",
		lead: "I need to log in to the staging server first. I'll ask you for the deploy account's password — it goes to Lyra, and all I get is its name.",
		card: { title: "Staging server deploy password", purpose: "Log in to the staging server and use df and du to find which directories filled the disk." },
		saved: {
			staging: "Staging server deploy password",
			github: "GitHub release token",
			npm: "npm publishing account",
			deploy: "aurora-notes deploy key",
		},
	},
} as const;

const STAGING = "ssh://deploy@staging.atlas-api.dev";

export function credentialAsk(lang: Lang): string {
	return words[lang].ask;
}

/** The model says why, and asks on a card. The turn then waits for the card. */
export function credentialScript(lang: Lang): Script {
	const w = words[lang];
	return {
		cue: w.ask.slice(0, 12),
		title: w.title,
		steps: [
			{
				text: w.lead,
				delay: 400,
				rate: 70,
				tools: [{ name: "request_credential", input: { name: "atlas-staging", title: w.card.title, purpose: w.card.purpose, kind: "password", target: STAGING } }],
			},
		],
	};
}

/** What `credentials.add` is given for each: one of every kind. */
export function savedCredentials(lang: Lang, privateKey: string): Record<string, unknown>[] {
	const t = words[lang].saved;
	return [
		{ name: "atlas-staging", kind: "password", title: t.staging, target: STAGING, approval: "per-conversation", values: { password: "EXAMPLE-PASSWORD-0000" } },
		{ name: "github-release", kind: "token", title: t.github, approval: "every-use", values: { token: "ghp_EXAMPLE000000000000000000000000000000" } },
		{ name: "npm-publish", kind: "login", title: t.npm, target: "https://registry.npmjs.org", approval: "per-conversation", values: { username: "mayachen", password: "EXAMPLE-PASSWORD-0000" } },
		{ name: "aurora-deploy", kind: "ssh_key", title: t.deploy, target: "ssh://deploy@aurora-notes.dev", approval: "per-conversation", values: { private_key: privateKey } },
	];
}
