import "lenis/dist/lenis.css";

import { gsap } from "gsap";
import Lenis from "lenis";

import { detectPlatform } from "./platform.ts";
import { quickHints } from "./platform-hints.ts";
import { refreshRelease } from "./release-client.ts";
import { syncTheme, watchTheme } from "./theme.ts";

/**
 * What every product page does once it is on screen: keep the theme and the screenshots in step
 * with the reader's choice, smooth the scrolling, run the navigation bar, name the reader's system
 * on the download buttons, bring headings and blocks in as they arrive, and swap in the current
 * release.
 *
 * Motion is transform and opacity only. With reduced motion there is no smooth scrolling and
 * everything simply fades in.
 */

const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

// ── Theme ────────────────────────────────────────────────────────────
// Shared with the docs (`theme.ts`): the stored choice, the system while there is none, and the
// screenshots' dark variants following whichever the page is drawn in.

syncTheme();
watchTheme();

// ── Smooth scrolling ─────────────────────────────────────────────────
// Lenis smooths the wheel and leaves touch alone. It runs on GSAP's clock so scroll-linked
// animations read the same scroll position in the same frame.

export const lenis: Lenis | null = reduceMotion ? null : new Lenis({ lerp: 0.11, autoRaf: false, stopInertiaOnNavigate: true });
if (lenis) {
	gsap.ticker.add((time) => lenis.raf(time * 1000));
	gsap.ticker.lagSmoothing(0);
}

function navHeight(): number {
	return document.querySelector<HTMLElement>("[data-nav] .nav-bar")?.offsetHeight ?? 52;
}

/** In-page links glide there (or jump, with reduced motion), and focus follows for keyboards. */
document.addEventListener("click", (event) => {
	if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
	const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href*='#']");
	if (!link || link.classList.contains("skip-link")) return;
	const url = new URL(link.href);
	if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
	const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
	if (!target) return;
	event.preventDefault();
	closeMenu();
	history.pushState(null, "", url.hash);
	const offset = -navHeight() - 8;
	if (lenis) lenis.scrollTo(target, { offset, duration: 1.4 });
	else scrollTo({ top: target.getBoundingClientRect().top + scrollY + offset });
	if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
	target.focus({ preventScroll: true });
});

// ── Navigation bar ───────────────────────────────────────────────────

const nav = document.querySelector<HTMLElement>("[data-nav]");
const toggle = nav?.querySelector<HTMLButtonElement>("[data-nav-toggle]");
const sheet = nav?.querySelector<HTMLElement>("[data-nav-sheet]");

// Frosted once the page has moved at all.
let scrolled = false;
function onScroll(): void {
	const now = scrollY > 4;
	if (now !== scrolled && nav) {
		scrolled = now;
		nav.toggleAttribute("data-scrolled", now);
	}
}
onScroll();
addEventListener("scroll", onScroll, { passive: true });

// Dark over the dark sections: whichever section crosses the bar's midline decides.
const nights = [...document.querySelectorAll<HTMLElement>("[data-night]")];
if (nav && nights.length > 0) {
	const over = new Set<Element>();
	let observer: IntersectionObserver | null = null;
	const observe = () => {
		observer?.disconnect();
		const line = Math.round(navHeight() / 2);
		observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) over.add(entry.target);
					else over.delete(entry.target);
				}
				nav.classList.toggle("surface-night", over.size > 0);
			},
			{ rootMargin: `-${line}px 0px -${Math.max(0, innerHeight - line - 1)}px 0px` },
		);
		for (const night of nights) observer.observe(night);
	};
	observe();
	let resizeTimer = 0;
	addEventListener("resize", () => {
		clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(observe, 150);
	});
}

function openMenu(): void {
	if (!nav || !toggle || !sheet) return;
	sheet.hidden = false;
	nav.setAttribute("data-open", "");
	toggle.setAttribute("aria-expanded", "true");
	toggle.setAttribute("aria-label", toggle.dataset.closeLabel ?? "");
	lenis?.stop();
	root.style.overflow = "hidden";
	sheet.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
}

function closeMenu(returnFocus = false): void {
	if (!nav || !toggle || !sheet || sheet.hidden) return;
	sheet.hidden = true;
	nav.removeAttribute("data-open");
	toggle.setAttribute("aria-expanded", "false");
	toggle.setAttribute("aria-label", toggle.dataset.openLabel ?? "");
	root.style.overflow = "";
	lenis?.start();
	if (returnFocus) toggle.focus();
}

toggle?.addEventListener("click", () => (sheet?.hidden ? openMenu() : closeMenu()));
document.addEventListener("keydown", (event) => {
	if (event.key === "Escape") closeMenu(true);
});
// A sheet left open across a resize to desktop would lock the page.
matchMedia("(min-width: 52.01rem)").addEventListener("change", (event) => {
	if (event.matches) closeMenu();
});

// ── Download buttons ─────────────────────────────────────────────────
// "Download" becomes "Download for Mac" once the user agent says which system this is. The
// quick hints are enough for the system; which build to fetch is the download page's business.

const os = detectPlatform(quickHints()).os;
if (os) {
	for (const button of document.querySelectorAll<HTMLElement>("[data-download-cta]")) {
		const labels = JSON.parse(button.dataset.labels ?? "{}") as Record<string, string>;
		const label = button.querySelector("[data-cta-label]");
		if (label && labels[os]) label.textContent = labels[os];
		button.dataset.os = os;
	}
}

// ── Magnetic buttons ─────────────────────────────────────────────────
// The large buttons lean a few pixels towards the pointer. Moved through custom properties, so
// the stylesheet still owns the press (`scale`) and nothing fights over `transform`.

if (finePointer && !reduceMotion) {
	for (const button of document.querySelectorAll<HTMLElement>(".btn-lg")) {
		button.classList.add("is-magnetic");
		const x = gsap.quickTo(button, "--mx", { duration: 0.5, ease: "power3.out" });
		const y = gsap.quickTo(button, "--my", { duration: 0.5, ease: "power3.out" });
		button.addEventListener("pointermove", (event) => {
			const box = button.getBoundingClientRect();
			x(((event.clientX - box.left) / box.width - 0.5) * 8);
			y(((event.clientY - box.top) / box.height - 0.5) * 6);
		});
		button.addEventListener("pointerleave", () => {
			x(0);
			y(0);
		});
	}
}

// ── Arrivals ─────────────────────────────────────────────────────────
// Blocks marked `data-reveal` rise and fade in the first time they come into view; split
// headings rise word by word out of their masks. Done with classes and CSS transitions — cheap,
// interruptible, and the same with or without the home page's heavier script. The hero is left
// to that script, which opens the page with its own timeline.

function prepareSplits(scope: ParentNode): void {
	for (const heading of scope.querySelectorAll<HTMLElement>("[data-split]")) {
		heading.querySelectorAll<HTMLElement>(".word-inner, .line-inner").forEach((piece, index) => {
			piece.style.setProperty("--i", String(index));
		});
	}
}

const arriving = [...document.querySelectorAll<HTMLElement>("[data-reveal], [data-split]")].filter((element) => !element.closest("[data-hero]"));
prepareSplits(document);

// Followed a link from another page of the site: the page transition has brought the first screen
// in, so what is already in view is simply there. Whatever is further down still arrives as usual.
if (root.classList.contains("nav-arrival")) {
	for (const element of arriving.splice(0)) {
		const box = element.getBoundingClientRect();
		if (box.top < innerHeight && box.bottom > 0) element.classList.add("is-in", "is-instant");
		else arriving.push(element);
	}
}

if ("IntersectionObserver" in window) {
	const arrive = new IntersectionObserver(
		(entries) => {
			// Things arriving together are staggered, in reading order.
			const incoming = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target as HTMLElement);
			incoming.forEach((element, index) => {
				element.style.setProperty("--stagger", `${Math.min(index, 6) * 80}ms`);
				element.classList.add("is-in");
				arrive.unobserve(element);
			});
		},
		{ rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
	);
	for (const element of arriving) arrive.observe(element);
} else {
	for (const element of arriving) element.classList.add("is-in");
}

// Pages without the home page's hero have nothing else to wait for.
if (!document.querySelector("[data-hero]")) root.classList.add("motion-ready");

// ── The current release ──────────────────────────────────────────────

void refreshRelease();
