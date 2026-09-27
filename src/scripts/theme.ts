/**
 * The reader's theme: the choice they made (`light`, `dark`, or `auto` to follow the system),
 * stored under Starlight's own key so the product pages and the docs agree, and what that choice
 * resolves to right now.
 *
 * Choosing a theme redraws the page through a view transition — the new theme grows out of the
 * control that chose it in a circle — where the browser can and motion is welcome; otherwise it
 * simply changes.
 */

export type ThemeChoice = "auto" | "light" | "dark";

const KEY = "starlight-theme";
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

export function storedChoice(): ThemeChoice {
	try {
		const value = localStorage.getItem(KEY);
		return value === "light" || value === "dark" ? value : "auto";
	} catch {
		return "auto";
	}
}

function resolve(choice: ThemeChoice): "light" | "dark" {
	return choice === "auto" ? (systemDark.matches ? "dark" : "light") : choice;
}

/**
 * Screenshots pick their dark variant by media query, which only knows the system's preference;
 * a stored choice rewrites the query so the pictures follow the page instead.
 */
function syncPictures(choice: ThemeChoice): void {
	const media = choice === "dark" ? "all" : choice === "light" ? "not all" : "(prefers-color-scheme: dark)";
	for (const source of document.querySelectorAll<HTMLSourceElement>("source[data-dark-source]")) {
		if (source.media !== media) source.media = media;
	}
}

/** Draw the page in the stored theme, without ceremony: on load, and when the system changes. */
export function syncTheme(): void {
	const choice = storedChoice();
	document.documentElement.dataset.theme = resolve(choice);
	syncPictures(choice);
	document.dispatchEvent(new CustomEvent<ThemeChoice>("lyra:theme", { detail: choice }));
}

/**
 * Fetch the other theme's version of the pictures in view, ahead of a choice: called when the
 * theme menu opens, so by the time a theme is picked its shots are usually in the cache already.
 */
export function warmPictures(): void {
	const toDark = document.documentElement.dataset.theme !== "dark";
	for (const picture of document.querySelectorAll<HTMLPictureElement>("picture")) {
		const box = picture.getBoundingClientRect();
		if (box.width === 0 || box.bottom < 0 || box.top > innerHeight) continue;
		const source = picture.querySelector<HTMLSourceElement>(toDark ? "source[data-dark-source]" : "source:not([data-dark-source])");
		if (!source || picture.dataset.warmed === String(toDark)) continue;
		picture.dataset.warmed = String(toDark);
		const probe = new Image();
		probe.sizes = source.sizes;
		probe.srcset = source.srcset;
	}
	// The docs theme a picture Starlight's way: two images, the other theme's one `display: none`.
	// A lazy image that is not displayed is never fetched, so without this the new theme's
	// screenshot only starts downloading after the switch, and the circle uncovers an empty frame.
	for (const img of document.querySelectorAll<HTMLImageElement>(toDark ? DOCS_DARK : DOCS_LIGHT)) {
		const shown = img.parentElement?.querySelector<HTMLImageElement>(toDark ? DOCS_LIGHT : DOCS_DARK);
		const box = (shown ?? img).getBoundingClientRect();
		if (box.width === 0 || box.bottom < 0 || box.top > innerHeight) continue;
		img.loading = "eager";
	}
}

/** Starlight's themed pictures: `light:sl-hidden` is the one shown in dark, and the reverse. */
const DOCS_DARK = "img.light\\:sl-hidden";
const DOCS_LIGHT = "img.dark\\:sl-hidden";

/**
 * Pictures in view that are switching to the other theme's shot: wait for them, briefly, so the
 * circle uncovers the new theme with its pictures already in it rather than a moment before them.
 */
function picturesReady(limit: number): Promise<void> {
	return new Promise((resolve) => {
		// A task later, once the pictures have picked their new source.
		setTimeout(() => {
			const pending = [...document.querySelectorAll<HTMLImageElement>(`picture img, ${DOCS_DARK}, ${DOCS_LIGHT}`)].filter((img) => {
				if (img.complete) return false;
				const box = img.getBoundingClientRect();
				return box.width > 0 && box.bottom > 0 && box.top < innerHeight;
			});
			if (pending.length === 0) return resolve();
			const timer = setTimeout(resolve, limit);
			let left = pending.length;
			const done = () => {
				if (--left > 0) return;
				clearTimeout(timer);
				resolve();
			};
			for (const img of pending) {
				img.addEventListener("load", done, { once: true });
				img.addEventListener("error", done, { once: true });
			}
		}, 0);
	});
}

/** Store a new choice and redraw, the new theme revealed in a circle from `origin` (viewport px). */
export function chooseTheme(choice: ThemeChoice, origin?: { x: number; y: number }): void {
	try {
		localStorage.setItem(KEY, choice === "auto" ? "" : choice);
	} catch {
		// Private mode without storage: the choice lasts as long as the page.
	}
	const root = document.documentElement;
	const unchanged = root.dataset.theme === resolve(choice);
	const start = (document as Document & { startViewTransition?: (update: () => void | Promise<void>) => ViewTransition }).startViewTransition;
	if (unchanged || !start || reduceMotion.matches) {
		syncTheme();
		return;
	}
	const x = origin?.x ?? innerWidth - 48;
	const y = origin?.y ?? 26;
	const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
	// While this runs, nothing keeps its own transition name: the whole page is one picture that
	// the circle uncovers, rather than a nav bar cross-fading on its own.
	root.classList.add("theme-transition");
	const transition = start.call(document, () => {
		syncTheme();
		return picturesReady(400);
	});
	transition.ready
		.then(() => {
			root.animate(
				{ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
				{ duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
			);
		})
		.catch(() => {});
	transition.finished.finally(() => root.classList.remove("theme-transition"));
}

/** Follow the system while the choice is `auto`, and a choice made in another tab. */
export function watchTheme(): void {
	systemDark.addEventListener("change", () => {
		if (storedChoice() === "auto") syncTheme();
	});
	addEventListener("storage", (event) => {
		if (event.key === KEY) syncTheme();
	});
}
