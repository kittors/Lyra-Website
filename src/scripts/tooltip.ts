/**
 * The site's tooltip, in place of the browser's `title` bubble: one small floating label, drawn
 * like the rest of the site, for any element with `data-tip`. It appears after a short hover or on
 * keyboard focus, beside the element (`data-tip-side="left"`) or above it, and goes on leave, blur,
 * click or Escape.
 */

let tip: HTMLElement | null = null;
let timer = 0;
let owner: HTMLElement | null = null;

function element(): HTMLElement {
	if (tip) return tip;
	tip = document.createElement("div");
	tip.className = "lyra-tip";
	tip.setAttribute("role", "tooltip");
	tip.id = "lyra-tip";
	document.body.append(tip);
	return tip;
}

function show(target: HTMLElement): void {
	const text = target.dataset.tip;
	if (!text) return;
	const node = element();
	owner = target;
	node.textContent = text;
	node.classList.remove("is-shown");
	const box = target.getBoundingClientRect();
	const width = node.offsetWidth;
	const height = node.offsetHeight;
	const side = target.dataset.tipSide === "left" ? "left" : box.top > height + 12 ? "top" : "bottom";
	let x = side === "left" ? box.left - width - 8 : box.left + box.width / 2 - width / 2;
	let y = side === "left" ? box.top + box.height / 2 - height / 2 : side === "top" ? box.top - height - 8 : box.bottom + 8;
	x = Math.min(Math.max(8, x), innerWidth - width - 8);
	y = Math.min(Math.max(8, y), innerHeight - height - 8);
	node.style.left = `${Math.round(x)}px`;
	node.style.top = `${Math.round(y)}px`;
	node.dataset.side = side;
	target.setAttribute("aria-describedby", node.id);
	requestAnimationFrame(() => node.classList.add("is-shown"));
}

function hide(): void {
	clearTimeout(timer);
	tip?.classList.remove("is-shown");
	owner?.removeAttribute("aria-describedby");
	owner = null;
}

export function wireTooltips(): void {
	document.addEventListener("pointerover", (event) => {
		const target = (event.target as Element | null)?.closest<HTMLElement>("[data-tip]");
		if (!target || target === owner) return;
		clearTimeout(timer);
		timer = window.setTimeout(() => show(target), 380);
	});
	document.addEventListener("pointerout", (event) => {
		const target = (event.target as Element | null)?.closest<HTMLElement>("[data-tip]");
		if (target && !target.contains(event.relatedTarget as Node | null)) hide();
	});
	document.addEventListener("focusin", (event) => {
		const target = (event.target as Element | null)?.closest<HTMLElement>("[data-tip]");
		if (target?.matches(":focus-visible")) show(target);
	});
	document.addEventListener("focusout", hide);
	document.addEventListener("pointerdown", hide, true);
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") hide();
	});
	addEventListener("scroll", hide, { passive: true, capture: true });
}

function replaceTitle(node: HTMLElement): void {
	const text = node.getAttribute("title");
	node.removeAttribute("title");
	if (!text) return;
	if (!node.hasAttribute("aria-label") && !node.textContent?.trim()) node.setAttribute("aria-label", text);
	// A field says what it is with its placeholder; the title only names it for assistive technology.
	if (node.matches("input, textarea, select")) return;
	node.dataset.tip = text;
	// Code blocks keep their copy button in the top right corner: the label goes to its left.
	if (node.closest(".expressive-code")) node.dataset.tipSide = "left";
}

/**
 * Turn every native `title` bubble into the site's own tooltip: those in the page now, and those
 * that scripts add later (the search box is built when the page loads).
 */
export function replaceTitles(): void {
	for (const node of document.querySelectorAll<HTMLElement>("[title]")) replaceTitle(node);
	new MutationObserver((records) => {
		for (const record of records) {
			if (record.type === "attributes") {
				if (record.target instanceof HTMLElement && record.target.hasAttribute("title")) replaceTitle(record.target);
				continue;
			}
			for (const added of record.addedNodes) {
				if (!(added instanceof HTMLElement)) continue;
				if (added.hasAttribute("title")) replaceTitle(added);
				for (const node of added.querySelectorAll<HTMLElement>("[title]")) replaceTitle(node);
			}
		}
	}).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["title"] });
}
