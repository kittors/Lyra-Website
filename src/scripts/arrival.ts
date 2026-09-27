/**
 * Inline, in the <head> of every page (product pages and docs alike), before anything is drawn.
 *
 * A page reached by following a link from another page of this site, in the same tab, gets
 * `nav-arrival`: the page transition brings its first screen in, so the page's own entrance (the
 * hero's opening, blocks rising into view) stands down rather than playing on top of it. Where the
 * browser has no cross-document view transitions, the page gets `page-fade` as well — a light fade
 * of the new content, so a click still does not cut. A reload, a first visit, a page opened in a new
 * tab, or reduced motion gets neither.
 */
/**
 * The opt-in to page transitions, inline in the <head> of every page rather than in a stylesheet:
 * the browser settles whether the arriving page takes part before its stylesheets are in — on a
 * slow connection a rule in a linked file comes too late, and the page simply cuts in.
 */
export const VIEW_TRANSITION_OPT_IN = "@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }";

export const ARRIVAL_SCRIPT = `(() => {
	const root = document.documentElement;
	try {
		if (matchMedia("(prefers-reduced-motion: reduce)").matches || history.length < 2) return;
		const entry = performance.getEntriesByType("navigation")[0];
		const kind = entry && entry.type;
		const from = document.referrer ? new URL(document.referrer) : null;
		if (!from || from.origin !== location.origin || (kind !== "navigate" && kind !== "back_forward")) return;
		root.classList.add("nav-arrival");
		if (!("CSSViewTransitionRule" in window) && !("onpagereveal" in window)) root.classList.add("page-fade");
	} catch {}
})();`;
