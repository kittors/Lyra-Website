import type { ImageMetadata } from "astro";

import data from "../data/market.json";

/**
 * The logo wall's icons, as `scripts/fetch-market.ts` left them: files under `src/assets/market/`,
 * listed in `src/data/market.json` in the order the wall shows them.
 */

export interface MarketIcon {
	id: string;
	name: string;
	kind: string;
	brandColor: string | null;
	/** The icon brings its own square background and fills its tile edge to edge. */
	filled: boolean;
	image: ImageMetadata;
}

const files = import.meta.glob<ImageMetadata>("../assets/market/*.{svg,webp,png,jpg}", { eager: true, import: "default" });

export const MARKET_ICONS: MarketIcon[] = data.icons.flatMap((icon) => {
	const image = files[`../assets/market/${icon.file}`];
	return image ? [{ id: icon.id, name: icon.name, kind: icon.kind, brandColor: icon.brandColor, filled: icon.filled, image }] : [];
});

/** How many entries the market listed when the icons were fetched. */
export const MARKET_TOTAL: number = data.total;
