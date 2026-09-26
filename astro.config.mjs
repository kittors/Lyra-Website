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
			customCss: ["./src/styles/tokens.css", "./src/styles/docs.css"],
			disable404Route: true,
			lastUpdated: true,
			editLink: { baseUrl: "https://github.com/kittors/Lyra-Website/edit/main/" },
		}),
	],
});
