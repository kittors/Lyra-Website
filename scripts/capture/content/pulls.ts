/**
 * Pull requests across the four projects, as a GitHub account would return them.
 *
 * Served by a stand-in GitHub Enterprise (see `scenes/pulls.ts`): the app queries it exactly as it
 * queries GitHub — the same GraphQL search and detail queries, the same diff endpoint. Everyone is
 * made up; avatars are identicons drawn here, in the style GitHub gives accounts without a photo.
 */

import { createHash } from "node:crypto";

import { FIXED_MERGE, MERGE_TEST } from "./hero.ts";
import { AURORA_MERGE } from "./projects.ts";
import type { Lang } from "./types.ts";

export const ME = "mayachen";
export const PEOPLE = [ME, "priya-raman", "jonas-lindqvist", "alex-okafor", "sam-whitfield"];

/** A 5×5 mirrored identicon, as an SVG data URL. */
export function identicon(login: string): string {
	const hash = createHash("md5").update(login).digest();
	const hue = Math.round((hash[0] / 255) * 360);
	const colour = `hsl(${hue} 55% 52%)`;
	const cells: string[] = [];
	for (let row = 0; row < 5; row++) {
		for (let col = 0; col < 3; col++) {
			if ((hash[1 + row * 3 + col] ?? 0) % 2 === 0) continue;
			for (const x of new Set([col, 4 - col])) cells.push(`<rect x="${x * 14 + 5}" y="${row * 14 + 5}" width="14" height="14"/>`);
		}
	}
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#f0f0f0"/><g fill="${colour}">${cells.join("")}</g></svg>`;
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const minutes = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

interface Pull {
	repo: string;
	number: number;
	title: string;
	author: string;
	relation: "reviewing" | "authored" | "reviewed";
	ago: number;
	createdAgo: number;
	additions: number;
	deletions: number;
	head: string;
	draft?: boolean;
	decision: "APPROVED" | "REVIEW_REQUIRED" | "CHANGES_REQUESTED" | null;
	checks: "SUCCESS" | "PENDING" | "FAILURE";
	comments: number;
}

const PULLS: Pull[] = [
	{ repo: "mayachen/aurora-notes", number: 142, title: "fix(sync): merge per block, ordered by hybrid clock", author: ME, relation: "authored", ago: 18, createdAgo: 95, additions: 27, deletions: 3, head: "fix/offline-merge", decision: "APPROVED", checks: "SUCCESS", comments: 3 },
	{ repo: "atlas-labs/atlas-api", number: 418, title: "Raise the /v2/search limit cap to 200", author: "jonas-lindqvist", relation: "reviewing", ago: 52, createdAgo: 400, additions: 38, deletions: 6, head: "search-limit-200", decision: "REVIEW_REQUIRED", checks: "SUCCESS", comments: 4 },
	{ repo: "lumen-design/lumen-ui", number: 87, title: "Button: AA contrast for the soft variant in dark mode", author: "priya-raman", relation: "reviewing", ago: 140, createdAgo: 700, additions: 22, deletions: 9, head: "soft-button-contrast", decision: "REVIEW_REQUIRED", checks: "PENDING", comments: 1 },
	{ repo: "mayachen/aurora-notes", number: 139, title: "feat(editor): Tab moves between table cells", author: ME, relation: "authored", ago: 190, createdAgo: 260, additions: 45, deletions: 0, head: "editor-table-tab", decision: "REVIEW_REQUIRED", checks: "SUCCESS", comments: 0 },
	{ repo: "mayachen/orbit-cli", number: 56, title: "Release 0.8.0", author: ME, relation: "authored", ago: 330, createdAgo: 1500, additions: 112, deletions: 40, head: "release/0.8", draft: true, decision: null, checks: "FAILURE", comments: 2 },
	{ repo: "lumen-design/lumen-ui", number: 90, title: "Tooltip: interaction tests", author: "alex-okafor", relation: "reviewed", ago: 1300, createdAgo: 2900, additions: 140, deletions: 12, head: "tooltip-tests", decision: "CHANGES_REQUESTED", checks: "SUCCESS", comments: 6 },
];

const url = (pull: Pull) => `https://github.com/${pull.repo}/pull/${pull.number}`;

/** A search node, the fields the list query asks for. */
function node(pull: Pull) {
	return {
		number: pull.number,
		title: pull.title,
		url: url(pull),
		state: "OPEN",
		isDraft: pull.draft === true,
		createdAt: minutes(pull.createdAgo),
		updatedAt: minutes(pull.ago),
		additions: pull.additions,
		deletions: pull.deletions,
		headRefName: pull.head,
		reviewDecision: pull.decision,
		author: { login: pull.author, avatarUrl: `https://avatars.example/${pull.author}` },
		repository: { nameWithOwner: pull.repo },
		comments: { totalCount: pull.comments },
		commits: { nodes: [{ commit: { statusCheckRollup: { state: pull.checks } } }] },
	};
}

/** The body of the search query: three buckets. */
export function searchResponse() {
	const bucket = (relation: Pull["relation"]) => ({ nodes: PULLS.filter((pull) => pull.relation === relation).map(node) });
	return { data: { reviewing: bucket("reviewing"), authored: bucket("authored"), reviewed: bucket("reviewed") } };
}

const BODY: Record<Lang, string> = {
	zh: [
		"## 问题",
		"",
		"两台设备离线编辑同一篇笔记，同步回来有一边的修改会丢：`mergeNote` 按各自设备的墙上时钟比较，后写的一方**整篇覆盖**另一方。",
		"",
		"## 修复",
		"",
		"- 改为按块三方合并（`mergeBlocks`），两边改了不同段落时都保留",
		"- 两边改了同一块时，按混合逻辑时钟（HLC）排序，不再依赖设备时钟准不准",
		"",
		"## 测试",
		"",
		"- [x] 新增 `test/sync/merge.test.ts`，覆盖不同段落和时钟偏差两种场景",
		"- [x] `npx vitest run` 全部通过",
		"",
		"Closes #137",
	].join("\n"),
	en: [
		"## Problem",
		"",
		"When two devices edit the same note offline, one side's changes are lost on sync: `mergeNote` compares each device's own wall clock and the later writer **overwrites the whole note**.",
		"",
		"## Fix",
		"",
		"- Merge per block (`mergeBlocks`), so edits to different paragraphs both survive",
		"- Where both sides changed a block, order the edits by hybrid logical clock instead of device time",
		"",
		"## Tests",
		"",
		"- [x] New `test/sync/merge.test.ts` covering different paragraphs and clock skew",
		"- [x] `npx vitest run` passes",
		"",
		"Closes #137",
	].join("\n"),
};

const TALK: Record<Lang, { comments: [string, string, number][]; reviews: [string, string, string, number][] }> = {
	zh: {
		comments: [
			["priya-raman", "时钟偏差那个场景抓得好，之前一直以为是网络问题。", 70],
			[ME, "顺手把 `bases` 的写入也挪进了同一个事务，免得合并一半断电。", 55],
			["jonas-lindqvist", "`maxHlc` 可以单独补一个测试，不急，下个 PR 也行。", 40],
		],
		reviews: [
			["priya-raman", "APPROVED", "LGTM，两个场景都覆盖到了。", 35],
			["jonas-lindqvist", "COMMENTED", "", 40],
		],
	},
	en: {
		comments: [
			["priya-raman", "Great catch on the clock skew — we had been blaming the network.", 70],
			[ME, "Also moved the `bases` write into the same transaction, so a crash mid-merge cannot split them.", 55],
			["jonas-lindqvist", "A test for `maxHlc` on its own would be nice. No rush — next PR is fine.", 40],
		],
		reviews: [
			["priya-raman", "APPROVED", "LGTM, both scenarios covered.", 35],
			["jonas-lindqvist", "COMMENTED", "", 40],
		],
	},
};

const CHECKS = ["test (ubuntu-latest)", "test (macos-latest)", "typecheck", "lint", "e2e (chromium)"];

/** The detail query's answer for one pull request. */
export function detailResponse(lang: Lang, repo: string, number: number) {
	const pull = PULLS.find((one) => one.repo === repo && one.number === number);
	if (!pull) return { data: { repository: { pullRequest: null } } };
	const lead = pull.number === 142;
	const talk = TALK[lang];
	return {
		data: {
			repository: {
				pullRequest: {
					...node(pull),
					body: lead ? BODY[lang] : "",
					changedFiles: lead ? 2 : 3,
					baseRefName: "main",
					mergeable: "MERGEABLE",
					labels: { nodes: lead ? [{ name: "bug" }, { name: "sync" }] : [] },
					comments: lead
						? { totalCount: talk.comments.length, nodes: talk.comments.map(([login, body, ago]) => ({ author: { login }, body, createdAt: minutes(ago) })) }
						: { totalCount: 0, nodes: [] },
					reviews: { nodes: lead ? talk.reviews.map(([login, state, body, ago]) => ({ author: { login }, state, body, submittedAt: minutes(ago) })) : [] },
					reviewRequests: { nodes: lead ? [] : [{ requestedReviewer: { login: ME } }] },
					history: {
						nodes: lead
							? [
									{ commit: { oid: "4f9c2ab1e07d", messageHeadline: "fix(sync): merge per block, ordered by hybrid clock", committedDate: minutes(95), author: { name: "Maya Chen", user: { login: ME } } } },
									{ commit: { oid: "b81e5d3c9a42", messageHeadline: "test(sync): cover offline merge conflicts", committedDate: minutes(60), author: { name: "Maya Chen", user: { login: ME } } } },
								]
							: [],
					},
					checks: {
						nodes: [
							{
								commit: {
									statusCheckRollup: {
										contexts: { nodes: CHECKS.map((name) => ({ name, conclusion: "SUCCESS", status: "COMPLETED", detailsUrl: `https://github.com/${pull.repo}/actions` })) },
									},
								},
							},
						],
					},
				},
			},
		},
	};
}

/** `git diff`-style text for the lead pull request's code tab. */
export function diffText(): string {
	const lines = (text: string) => text.replace(/\n$/, "").split("\n");
	const before = lines(AURORA_MERGE);
	const after = lines(FIXED_MERGE);
	let at = 0;
	while (before[at] === after[at]) at++;
	let tailB = before.length - 1;
	let tailA = after.length - 1;
	while (before[tailB] === after[tailA]) {
		tailB--;
		tailA--;
	}
	const start = Math.max(0, at - 3);
	const hunk = [
		...before.slice(start, at).map((line) => ` ${line}`),
		...before.slice(at, tailB + 1).map((line) => `-${line}`),
		...after.slice(at, tailA + 1).map((line) => `+${line}`),
		...before.slice(tailB + 1, tailB + 4).map((line) => ` ${line}`),
	];
	const merge = [
		"diff --git a/src/sync/merge.ts b/src/sync/merge.ts",
		"--- a/src/sync/merge.ts",
		"+++ b/src/sync/merge.ts",
		`@@ -${start + 1},${hunk.filter((l) => !l.startsWith("+")).length} +${start + 1},${hunk.filter((l) => !l.startsWith("-")).length} @@`,
		...hunk,
	];
	const test = lines(MERGE_TEST);
	const added = ["diff --git a/test/sync/merge.test.ts b/test/sync/merge.test.ts", "new file mode 100644", "--- /dev/null", "+++ b/test/sync/merge.test.ts", `@@ -0,0 +1,${test.length} @@`, ...test.map((line) => `+${line}`)];
	return `${[...merge, ...added].join("\n")}\n`;
}
