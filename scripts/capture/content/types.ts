/** The two interface languages the website ships screenshots in. */
export type Lang = "zh" | "en";

/** Lyra's own name for each. */
export const UI_LOCALE: Record<Lang, "zh-CN" | "en"> = { zh: "zh-CN", en: "en" };

export interface ProjectSpec {
	name: string;
	/** The GitHub account or organisation the remote appears to live under. */
	owner: string;
	branch: string;
	/** Commits, oldest first. Each writes its files and commits them at `when`. */
	history: { message: string; files: Record<string, string>; when: string }[];
	/** Uncommitted changes on top. */
	working?: Record<string, string>;
	/** Suites the fake `npx vitest` reports, when the project has one. */
	vitest?: { file: string; tests: number; ms: number }[];
}
