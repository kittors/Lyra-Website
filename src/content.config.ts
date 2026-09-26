import { defineCollection } from "astro:content";
import { docsLoader, i18nLoader } from "@astrojs/starlight/loaders";
import { docsSchema, i18nSchema } from "@astrojs/starlight/schema";

export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
	// Starlight's own interface strings, where its defaults do not say what this site means.
	i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
