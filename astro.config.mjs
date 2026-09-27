// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

/**
 * One Astro site with two halves.
 *
 * The product pages (`src/pages`) are hand-built: the home page and the download page, in Chinese at
 * the root and English under `/en/`. The documentation (`src/content/docs/docs/**`) is Starlight, at
 * `/docs/` and `/en/docs/`. Both halves share one look — `src/styles/tokens.css` — so moving from the
 * home page into the docs does not feel like leaving the site.
 *
 * The output is static. What has to be decided per request — which mirror a download comes from, what
 * the latest release is — is the Worker's job (`worker/`), not the build's.
 */
export default defineConfig({
	site: "https://lyra.07230805.xyz",
	trailingSlash: "ignore",
	build: { format: "directory" },
	image: { layout: "constrained" },
	vite: {
		build: {
			rollupOptions: {
				// Astro marks every MDX page with a module-level "use astro:head-inject" directive, and
				// Rollup warns once per page that bundling may not preserve it. It is Astro's own marker,
				// consumed before bundling; the warning says nothing about this site.
				onwarn(warning, warn) {
					if (warning.code === "MODULE_LEVEL_DIRECTIVE" && String(warning.message).includes("astro:head-inject")) return;
					warn(warning);
				},
			},
		},
	},
	// The docs have no page of their own at their root; send it to the first one.
	redirects: {
		"/docs": "/docs/start/intro/",
		"/en/docs": "/en/docs/start/intro/",
	},
	integrations: [
		starlight({
			title: { "zh-CN": "Lyra 文档", en: "Lyra Docs" },
			description: "Lyra — a standalone AI agent for desktop and phone.",
			logo: { src: "./src/assets/brand/app-icon.png", replacesTitle: false },
			favicon: "/favicon.png",
			defaultLocale: "root",
			locales: {
				root: { label: "简体中文", lang: "zh-CN" },
				en: { label: "English", lang: "en" },
			},
			social: [{ icon: "github", label: "GitHub", href: "https://github.com/kittors/Lyra" }],
			sidebar: [
				{ label: "开始", translations: { en: "Get started" }, items: [{ autogenerate: { directory: "docs/start" } }] },
				{ label: "功能", translations: { en: "Features" }, items: [{ autogenerate: { directory: "docs/features" } }] },
				{ label: "扩展", translations: { en: "Extend" }, items: [{ autogenerate: { directory: "docs/extend" } }] },
				{ label: "帮助", translations: { en: "Help" }, items: [{ autogenerate: { directory: "docs/help" } }] },
			],
			customCss: ["./src/styles/tokens.css", "./src/styles/shared.css", "./src/styles/docs.css"],
			// The product pages' wordmark, a way back to the download page and the market, drawn
			// menus instead of the system's <select>, and the page-transition script in the head.
			components: {
				Head: "./src/components/docs/Head.astro",
				SiteTitle: "./src/components/docs/SiteTitle.astro",
				SocialIcons: "./src/components/docs/SocialIcons.astro",
				ThemeSelect: "./src/components/docs/ThemeSelect.astro",
				LanguageSelect: "./src/components/docs/LanguageSelect.astro",
			},
			head: [
				{ tag: "link", attrs: { rel: "apple-touch-icon", href: "/apple-touch-icon.png" } },
				{ tag: "meta", attrs: { property: "og:image", content: "https://lyra.07230805.xyz/og.png" } },
				{ tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
			],
			// Code blocks in the site's own terms: GitHub's colours, the system's mono face, the
			// same corner as the rest of the cards, and no drop shadow under a terminal.
			expressiveCode: {
				themes: ["github-dark-default", "github-light-default"],
				styleOverrides: {
					borderRadius: "0.875rem",
					borderColor: "var(--sl-color-hairline-light)",
					codeFontFamily: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
					uiFontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif',
					codeFontSize: "0.8125rem",
					codeLineHeight: "1.7",
					codePaddingBlock: "1rem",
					codePaddingInline: "1.25rem",
					frames: {
						shadowColor: "transparent",
						frameBoxShadowCssValue: "none",
						editorActiveTabIndicatorTopColor: "#0a6cf5",
						terminalTitlebarDotsOpacity: "0.55",
					},
				},
			},
			disable404Route: true,
			lastUpdated: true,
			editLink: { baseUrl: "https://github.com/kittors/Lyra-Website/edit/main/" },
		}),
	],
});
