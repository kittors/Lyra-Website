import type { Locale } from "./index.ts";

/** The words every page shares: navigation, footer, and the page titles. */
export const SITE_TEXT = {
	"zh-CN": {
		skip: "跳到正文",
		nav: {
			label: "主导航",
			features: "功能",
			market: "插件市场",
			docs: "文档",
			download: "下载",
			github: "Lyra 的 GitHub 仓库",
			menu: "打开菜单",
			close: "关闭菜单",
			switchTo: "EN",
			switchLabel: "Switch to English",
		},
		footer: {
			tagline: "智能体，自成一体。",
			columns: [
				{ title: "产品", links: ["features", "download", "notes"] },
				{ title: "资源", links: ["docs", "market", "releases"] },
				{ title: "开源", links: ["github", "issues", "contributing"] },
			],
			links: {
				features: "功能",
				download: "下载",
				notes: "更新日志",
				docs: "文档",
				market: "插件市场",
				releases: "历史版本",
				github: "GitHub",
				issues: "问题反馈",
				contributing: "参与贡献",
			},
			copyright: "© 2026 kittors。以 MIT 许可开源。",
			language: "English",
			languageLabel: "Switch to English",
		},
		meta: {
			home: { title: "Lyra — 智能体，自成一体", description: "从零实现的独立 AI 智能体。模型由你来配，桌面与手机共用一份会话。开源，支持 macOS、Windows、Linux、Android 与 iOS。" },
			download: { title: "下载 Lyra", description: "下载 Lyra：macOS、Windows、Linux、Android 与 iOS。免费，开源。" },
			notFound: { title: "找不到这一页 — Lyra", description: "这一页走丢了。" },
		},
	},
	en: {
		skip: "Skip to content",
		nav: {
			label: "Main",
			features: "Features",
			market: "Plugins",
			docs: "Docs",
			download: "Download",
			github: "Lyra on GitHub",
			menu: "Open menu",
			close: "Close menu",
			switchTo: "中文",
			switchLabel: "切换到中文",
		},
		footer: {
			tagline: "An agent of its own.",
			columns: [
				{ title: "Product", links: ["features", "download", "notes"] },
				{ title: "Resources", links: ["docs", "market", "releases"] },
				{ title: "Open source", links: ["github", "issues", "contributing"] },
			],
			links: {
				features: "Features",
				download: "Download",
				notes: "Release notes",
				docs: "Documentation",
				market: "Plugin market",
				releases: "All releases",
				github: "GitHub",
				issues: "Issues",
				contributing: "Contributing",
			},
			copyright: "© 2026 kittors. Open source under the MIT license.",
			language: "中文",
			languageLabel: "切换到中文",
		},
		meta: {
			home: { title: "Lyra — An agent of its own", description: "A standalone AI agent, built from scratch. Bring your own models; desktop and phone share one session log. Open source, for macOS, Windows, Linux, Android, and iOS." },
			download: { title: "Download Lyra", description: "Download Lyra for macOS, Windows, Linux, Android, and iOS. Free and open source." },
			notFound: { title: "Page not found — Lyra", description: "This page wandered off." },
		},
	},
} satisfies Record<Locale, unknown>;

export type FooterLink = keyof (typeof SITE_TEXT)["zh-CN"]["footer"]["links"];
