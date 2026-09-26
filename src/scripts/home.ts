import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { lenis } from "./site.ts";

/**
 * The home page's motion. One orchestrated opening (the hero), then each section moves in its own
 * way as it scrolls by: the window standing up, the tools lighting in turn, the split view pulling
 * back, the sub-agents finishing at their own pace, the workspace steps, the numbers rolling.
 *
 * Transforms and opacity only. `gsap.matchMedia` builds the full version for wide screens with
 * motion allowed, a lighter one for phones, and for reduced motion nothing that moves: the hero
 * and the counters simply appear, and scroll-linked effects are not created at all.
 */

gsap.registerPlugin(ScrollTrigger);
if (lenis) lenis.on("scroll", ScrollTrigger.update);

const root = document.documentElement;
const $ = <T extends Element = HTMLElement>(selector: string, scope: ParentNode = document) => scope.querySelector<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string, scope: ParentNode = document) => [...scope.querySelectorAll<T>(selector)];
const EASE = "expo.out";

// ── Rolling numbers ──────────────────────────────────────────────────
// A number becomes one strip of digits per column, each strip 0–9 twice, so a column rolls at
// least once round before it settles. Built before anything is visible; the widths are the same as
// the plain number's (tabular figures), so nothing shifts.

function buildOdometer(host: HTMLElement): HTMLElement[] {
	const value = host.dataset.count ?? host.textContent ?? "";
	const odo = document.createElement("span");
	odo.className = "odo";
	odo.setAttribute("aria-hidden", "true");
	const strips: HTMLElement[] = [];
	for (const char of value) {
		const column = document.createElement("span");
		column.className = "odo-col";
		const strip = document.createElement("span");
		strip.className = "odo-strip";
		strip.dataset.digit = char;
		for (let n = 0; n < 20; n++) {
			const digit = document.createElement("span");
			digit.className = "odo-digit";
			digit.textContent = String(n % 10);
			strip.append(digit);
		}
		column.append(strip);
		odo.append(column);
		strips.push(strip);
	}
	const label = document.createElement("span");
	label.className = "sr-only";
	label.textContent = value;
	host.replaceChildren(odo, label);
	host.classList.add("has-odo");
	return strips;
}

function rollTo(strips: HTMLElement[], instant: boolean): void {
	strips.forEach((strip, index) => {
		const target = 10 + Number(strip.dataset.digit ?? 0);
		const y = -target * 5; // each digit is 5% of a 20-digit strip
		if (instant) gsap.set(strip, { yPercent: y });
		else gsap.to(strip, { yPercent: y, duration: 1.6 + index * 0.25, ease: "power3.out", delay: 0.1 });
	});
}

const odometers = $$("[data-count]").map((host) => ({ host, strips: buildOdometer(host) }));

// ── The opening ──────────────────────────────────────────────────────

function hero(full: boolean, reduce: boolean): void {
	const section = $("[data-hero]");
	if (!section) return;
	const part = (name: string) => $(`[data-hero-part="${name}"]`, section);
	const words = $$(".word-inner", section);
	const glow = $("[data-hero-glow]", section);
	const [icon, name, lead, actions, meta, stage] = ["icon", "name", "lead", "actions", "meta", "stage"].map(part);
	const tilt = $("[data-hero-tilt]", section);
	const copy = $("[data-hero-copy]", section);

	if (reduce) {
		gsap.to([icon, name, ...words, lead, actions, meta, stage], { opacity: 1, duration: 0.8, stagger: 0.04, ease: "power1.out" });
		return;
	}

	gsap.set(words, { yPercent: 115, opacity: 1 });
	const opening = gsap.timeline({ defaults: { ease: EASE } });
	opening
		.fromTo(glow, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 2.4, ease: "power2.out" }, 0)
		.fromTo(icon, { opacity: 0, y: 28, scale: 0.84 }, { opacity: 1, y: 0, scale: 1, duration: 1.4 }, 0.05)
		.fromTo(name, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.2 }, 0.18)
		.to(words, { yPercent: 0, duration: 1.3, stagger: 0.09 }, 0.26)
		.fromTo(lead, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1.2 }, 0.58)
		.fromTo(actions, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1.2 }, 0.68)
		.fromTo(meta, { opacity: 0 }, { opacity: 1, duration: 1.2 }, 0.86)
		.fromTo(stage, { opacity: 0, y: full ? 160 : 90 }, { opacity: 1, y: 0, duration: 2, ease: "expo.out" }, 0.5);

	// The window leans back and stands up as the reader scrolls to it.
	if (tilt && stage) {
		gsap.fromTo(
			tilt,
			{ transformPerspective: 1600, rotateX: full ? 24 : 14, scale: full ? 0.9 : 0.96, transformOrigin: "50% 0%" },
			{
				rotateX: 0,
				scale: 1,
				ease: "none",
				scrollTrigger: {
					trigger: stage,
					start: "top bottom",
					end: () => `+=${Math.max(240, stage.offsetHeight * 0.5 + innerHeight * 0.35)}`,
					scrub: 0.6,
				},
			},
		);
	}

	// The words drift up and fade a little as the window takes over the screen.
	if (full && copy) {
		gsap.to(copy, {
			yPercent: -14,
			opacity: 0.35,
			ease: "none",
			scrollTrigger: { trigger: section, start: "top top", end: "45% top", scrub: true },
		});
	}
}

// ── Sections ─────────────────────────────────────────────────────────

/**
 * Windows and cards marked `data-rise` come up from below and grow into place as they arrive.
 * `data-rise="solid"` rises without fading — for something in front of other things, which would
 * otherwise show them through itself on the way up.
 */
function rises(full: boolean): void {
	for (const element of $$("[data-rise]")) {
		const fade = element.dataset.rise !== "solid";
		gsap.fromTo(
			element,
			{ y: full ? 90 : 48, scale: full ? 0.94 : 0.97, ...(fade ? { opacity: 0.3 } : {}) },
			{ y: 0, scale: 1, ...(fade ? { opacity: 1 } : {}), ease: "none", scrollTrigger: { trigger: element, start: "top 98%", end: "top 55%", scrub: 0.8 } },
		);
	}
}

/** Things marked `data-parallax` move against the scroll by that fraction of their height. */
function parallax(): void {
	for (const element of $$("[data-parallax]")) {
		const amount = Number(element.dataset.parallax ?? 0);
		gsap.fromTo(
			element,
			{ yPercent: -amount * 50 },
			{ yPercent: amount * 50, ease: "none", scrollTrigger: { trigger: element, start: "top bottom", end: "bottom top", scrub: true } },
		);
	}
}

/** The twenty tools light up one by one, in the order an agent might call them. */
function tools(): void {
	const block = $("[data-tools]");
	if (!block) return;
	const chips = $$("[data-tool]", block).sort((a, b) => Number(a.dataset.call) - Number(b.dataset.call));
	const sweep = gsap.timeline({ scrollTrigger: { trigger: block, start: "top 70%", end: "bottom 30%", scrub: 0.5 } });
	chips.forEach((chip, index) => {
		const light = $(".tool-light", chip);
		const at = index * 0.4;
		sweep.to(chip, { opacity: 1, duration: 0.3, ease: "power1.out" }, at);
		if (light) sweep.to(light, { opacity: 1, duration: 0.25 }, at).to(light, { opacity: 0, duration: 0.7 }, at + 0.45);
	});
}

function counters(instant: boolean): void {
	for (const { host, strips } of odometers) {
		if (instant) {
			rollTo(strips, true);
			continue;
		}
		ScrollTrigger.create({ trigger: host, start: "top 88%", once: true, onEnter: () => rollTo(strips, false) });
	}
}

/**
 * The split view starts close on the first conversation — the origin sits where its column is in
 * the capture, a quarter of the way across — and pulls back until every pane is in view.
 */
function splitZoom(full: boolean): void {
	const frame = $("[data-split-window]");
	const picture = frame && $("[data-window-picture]", frame);
	if (!frame || !picture) return;
	gsap.fromTo(
		picture,
		{ scale: full ? 1.75 : 1.35, transformOrigin: "24% 12%" },
		{ scale: 1, ease: "none", scrollTrigger: { trigger: frame, start: "top 90%", end: "center 55%", scrub: 0.7 } },
	);
}

/** Three sub-agents finish at their own pace; then the conclusion comes back. Runs once. */
function lanes(): void {
	const card = $("[data-lanes]");
	if (!card) return;
	const bars = $$("[data-lane-bar]", card);
	const done = $$("[data-lane-done]", card);
	const foot = $("[data-lanes-foot]", card);
	gsap.set(bars, { scaleX: 0 });
	gsap.set(done, { opacity: 0, x: -6 });
	gsap.set(foot, { opacity: 0, y: 6 });
	const lengths = [2.1, 1.3, 2.7];
	const run = gsap.timeline({ paused: true });
	bars.forEach((bar, index) => {
		const start = 0.2 + index * 0.12;
		run.to(bar, { scaleX: 1, duration: lengths[index] ?? 2, ease: "power1.inOut" }, start);
		if (done[index]) run.to(done[index], { opacity: 1, x: 0, duration: 0.45, ease: "back.out(2.2)" }, start + (lengths[index] ?? 2));
	});
	if (foot) run.to(foot, { opacity: 1, y: 0, duration: 0.6, ease: EASE }, ">0.15");
	ScrollTrigger.create({ trigger: card, start: "top 85%", once: true, onEnter: () => run.play() });
	gsap.fromTo(card, { y: 60 }, { y: -30, ease: "none", scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: true } });
}

/**
 * The workspace's pinned steps: which one is showing follows how far the stage has scrolled. Only
 * built while the pinned layout is the one on screen (its own media query, below), so a window
 * resized across that width gets it built or taken down with the layout.
 */
function workspace(): void {
	const pinned = $("[data-ws-pinned]");
	if (!pinned || getComputedStyle(pinned).display === "none") return;
	const steps = $$("[data-ws-step]", pinned);
	const visual = $("[data-ws-visual]", pinned);
	const fill = $("[data-ws-progress]", pinned);
	if (!visual || steps.length === 0) return;
	let current = -1;
	const show = (index: number) => {
		if (index === current) return;
		current = index;
		steps.forEach((step, n) => step.classList.toggle("is-active", n === index));
		visual.dataset.active = String(index);
	};
	show(0);
	ScrollTrigger.create({
		trigger: pinned,
		start: "top top",
		end: "bottom bottom",
		onUpdate: (self) => show(Math.min(steps.length - 1, Math.floor(self.progress * steps.length * 0.999))),
	});
	if (fill) gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: pinned, start: "top top", end: "bottom bottom", scrub: true } });
}

/** The platform marks pop in one after another. */
function pops(): void {
	const marks = $$("[data-pop]");
	if (marks.length === 0) return;
	gsap.set(marks, { opacity: 0, y: 24, scale: 0.9 });
	ScrollTrigger.create({
		trigger: marks[0]!,
		start: "top 88%",
		once: true,
		onEnter: () => gsap.to(marks, { opacity: 1, y: 0, scale: 1, duration: 1, stagger: 0.07, ease: EASE }),
	});
}

/** Bento tiles arrive staggered, row by row. */
function bento(reduce: boolean): void {
	const grid = $("[data-bento]");
	if (!grid) return;
	ScrollTrigger.create({ trigger: grid, start: "top 80%", end: "bottom top", toggleClass: { targets: grid, className: "in-view" } });
	if (reduce) return;
	const tiles = $$("[data-tile]", grid);
	gsap.set(tiles, { opacity: 0, y: 48, scale: 0.97 });
	ScrollTrigger.batch(tiles, {
		start: "top 90%",
		once: true,
		onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, scale: 1, duration: 1.1, stagger: 0.08, ease: EASE, overwrite: true }),
	});
}

/** The agent's cursor in the browser tile glides to the button and clicks it, while on screen. */
function agentCursor(): void {
	const cursor = $("[data-agent-cursor]");
	const target = $("[data-browser-target]");
	const tile = cursor?.closest<HTMLElement>("[data-tile]");
	if (!cursor || !target || !tile) return;
	const ring = $(".agent-click", cursor);
	let onScreen = false;
	let running: gsap.core.Timeline | null = null;
	let next: gsap.core.Tween | null = null;

	// Aimed afresh each time round, so a resize between loops cannot leave it clicking air.
	const run = () => {
		next = null;
		if (!onScreen) return;
		gsap.set(cursor, { x: 0, y: 0 });
		const from = cursor.getBoundingClientRect();
		const to = target.getBoundingClientRect();
		const x = to.left + to.width * 0.6 - from.left;
		const y = to.top + to.height * 0.55 - from.top;
		running = gsap
			.timeline({ onComplete: () => (next = gsap.delayedCall(1.4, run)) })
			.to(cursor, { x, y, duration: 1.3, ease: "power3.inOut" }, 0.4)
			.to(target, { scale: 0.94, duration: 0.12, ease: "power2.out" })
			.fromTo(ring, { opacity: 0.9, scale: 0.4 }, { opacity: 0, scale: 1.7, duration: 0.6, ease: "power2.out" }, "<")
			.to(target, { scale: 1, duration: 0.35, ease: "back.out(3)" }, "<0.12")
			.to(cursor, { x: 0, y: 0, duration: 1.2, ease: "power3.inOut" }, "+=0.9");
	};

	ScrollTrigger.create({
		trigger: tile,
		start: "top bottom",
		end: "bottom top",
		onToggle: (self) => {
			onScreen = self.isActive;
			if (onScreen && !running?.isActive() && !next) run();
		},
	});
}

/** A light that follows the pointer across each bento tile. */
function spotlights(): void {
	for (const tile of $$("[data-tile]")) {
		const spot = document.createElement("span");
		spot.className = "tile-spot";
		spot.setAttribute("aria-hidden", "true");
		tile.prepend(spot);
		const x = gsap.quickTo(spot, "x", { duration: 0.6, ease: "power3.out" });
		const y = gsap.quickTo(spot, "y", { duration: 0.6, ease: "power3.out" });
		tile.addEventListener("pointermove", (event) => {
			const box = tile.getBoundingClientRect();
			x(event.clientX - box.left);
			y(event.clientY - box.top);
		});
	}
}

/** The mascot bobs gently, and rises into the closing section. */
function mascot(full: boolean): void {
	const figure = $("[data-mascot]");
	if (!figure) return;
	const image = figure.firstElementChild;
	if (image) gsap.to(image, { y: -10, duration: 2.8, ease: "sine.inOut", yoyo: true, repeat: -1 });
	gsap.fromTo(
		figure,
		{ y: full ? 70 : 40, scale: 0.9, opacity: 0 },
		{ y: 0, scale: 1, opacity: 1, ease: "none", scrollTrigger: { trigger: figure, start: "top 98%", end: "top 55%", scrub: 0.8 } },
	);
}

// ── Put together ─────────────────────────────────────────────────────

const media = gsap.matchMedia();
media.add(
	{
		full: "(min-width: 48.01rem) and (prefers-reduced-motion: no-preference)",
		compact: "(max-width: 48rem) and (prefers-reduced-motion: no-preference)",
		reduce: "(prefers-reduced-motion: reduce)",
	},
	(context) => {
		const { full = false, reduce = false } = context.conditions ?? {};
		hero(full, reduce);
		counters(reduce);
		bento(reduce);
		if (reduce) {
			// No sweep to light them, so they are simply all lit.
			gsap.set($$("[data-tool]"), { opacity: 1 });
			return;
		}
		rises(full);
		parallax();
		tools();
		splitZoom(full);
		lanes();
		pops();
		agentCursor();
		mascot(full);
	},
);
// The same query as the stylesheet's, so the steps are wired exactly while the pinned stage shows.
media.add("(min-width: 64.01rem) and (min-height: 34.01rem) and (prefers-reduced-motion: no-preference)", () => {
	workspace();
});

if (matchMedia("(hover: hover) and (pointer: fine)").matches) spotlights();

// Images arriving late change the page's height; recompute where everything starts and ends.
addEventListener("load", () => ScrollTrigger.refresh());
root.classList.add("motion-ready");
