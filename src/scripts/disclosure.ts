/**
 * `<lyra-disclosure>`: the behaviour of `Disclosure.astro`. The button opens and closes the panel;
 * the stylesheet animates the height. `data-moving` is set for as long as the panel is changing
 * size, so its content is clipped only then.
 */

const MOVE_MS = 440;

/** Open or close a disclosure. `animate: false` for changes made before the reader looks. */
export function setDisclosure(element: HTMLElement, open: boolean, animate = true): void {
	if (element.hasAttribute("data-open") === open) return;
	const trigger = element.querySelector<HTMLElement>(":scope > .disclosure-trigger");
	element.toggleAttribute("data-open", open);
	trigger?.setAttribute("aria-expanded", String(open));
	const state = element as HTMLElement & { movingTimer?: number };
	clearTimeout(state.movingTimer);
	if (!animate) {
		element.removeAttribute("data-moving");
		return;
	}
	element.setAttribute("data-moving", "");
	state.movingTimer = window.setTimeout(() => element.removeAttribute("data-moving"), MOVE_MS);
}

class LyraDisclosure extends HTMLElement {
	connectedCallback(): void {
		const trigger = this.querySelector<HTMLButtonElement>(":scope > .disclosure-trigger");
		if (!trigger || trigger.dataset.wired) return;
		trigger.dataset.wired = "";
		trigger.addEventListener("click", () => setDisclosure(this, !this.hasAttribute("data-open")));
	}
}

if (!customElements.get("lyra-disclosure")) customElements.define("lyra-disclosure", LyraDisclosure);
