import { chooseTheme, storedChoice, warmPictures, watchTheme, type ThemeChoice } from "./theme.ts";

/**
 * `<lyra-dropdown>`: the behaviour of `Dropdown.astro`.
 *
 * Opening moves focus into the listbox and marks the chosen option active; the arrow keys, Home and
 * End move the active option, type-ahead jumps to the first option starting with the letters typed,
 * Enter or Space chooses, Escape closes and hands focus back to the button, Tab closes and lets focus
 * move on. A pointer-down anywhere outside closes it too.
 *
 * The list is a manual popover, positioned by hand under the button (or above it, when there is no
 * room below) and kept there while the page scrolls or resizes. Browsers without popovers get the
 * same list hanging from the button.
 */

const popoverSupported = typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;

/** The docs have no site script of their own: the first theme control listens for the system. */
let following = false;
function followTheme(): void {
	if (following || document.documentElement.dataset.site === "product") return;
	following = true;
	watchTheme();
}
const GAP = 8;
const EDGE = 8;

class LyraDropdown extends HTMLElement {
	private trigger!: HTMLButtonElement;
	private panel!: HTMLElement;
	private list!: HTMLElement;
	private options: HTMLElement[] = [];
	private active = -1;
	private typed = "";
	private typedAt = 0;
	private closeTimer = 0;

	connectedCallback(): void {
		if (this.trigger) return;
		this.trigger = this.querySelector<HTMLButtonElement>(".dropdown-trigger")!;
		this.panel = this.querySelector<HTMLElement>("[data-dropdown-popover]")!;
		this.list = this.querySelector<HTMLElement>("[role=listbox]")!;
		this.options = [...this.list.querySelectorAll<HTMLElement>("[role=option]")];
		if (!popoverSupported) {
			this.panel.removeAttribute("popover");
			this.panel.classList.add("is-inline");
		}

		this.trigger.addEventListener("click", () => (this.isOpen ? this.close(true) : this.open()));
		this.trigger.addEventListener("keydown", (event) => {
			if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				this.open(event.key === "ArrowUp" ? "last" : "selected");
			}
		});
		this.list.addEventListener("keydown", (event) => this.onKey(event));
		this.list.addEventListener("click", (event) => {
			const option = (event.target as Element).closest<HTMLElement>("[role=option]");
			if (option) this.choose(this.options.indexOf(option));
		});
		this.list.addEventListener("pointermove", (event) => {
			const option = (event.target as Element).closest<HTMLElement>("[role=option]");
			if (option) this.setActive(this.options.indexOf(option), false);
		});

		if (this.dataset.kind === "theme") {
			followTheme();
			this.reflect(storedChoice());
			document.addEventListener("lyra:theme", (event) => this.reflect((event as CustomEvent<ThemeChoice>).detail));
		}
	}

	private get isOpen(): boolean {
		return this.trigger.getAttribute("aria-expanded") === "true";
	}

	open(which: "selected" | "last" = "selected"): void {
		if (this.isOpen) return;
		clearTimeout(this.closeTimer);
		if (popoverSupported) {
			if (!this.panel.matches(":popover-open")) this.panel.showPopover();
		} else {
			this.panel.classList.add("is-shown");
		}
		this.trigger.setAttribute("aria-expanded", "true");
		this.place();
		if (this.dataset.kind === "theme") warmPictures();
		// One frame in its closed pose first, so the opening is a transition rather than a jump.
		requestAnimationFrame(() => requestAnimationFrame(() => this.panel.classList.add("is-open")));
		const selected = this.options.findIndex((option) => option.getAttribute("aria-selected") === "true");
		this.setActive(which === "last" ? this.options.length - 1 : Math.max(0, selected), true);
		this.list.focus({ preventScroll: true });
		document.addEventListener("pointerdown", this.onOutside, true);
		addEventListener("resize", this.place);
		addEventListener("scroll", this.place, true);
	}

	close(returnFocus: boolean, instant = false): void {
		if (!this.isOpen) return;
		this.trigger.setAttribute("aria-expanded", "false");
		this.panel.classList.remove("is-open");
		this.list.removeAttribute("aria-activedescendant");
		document.removeEventListener("pointerdown", this.onOutside, true);
		removeEventListener("resize", this.place);
		removeEventListener("scroll", this.place, true);
		const hide = () => {
			if (popoverSupported) {
				if (this.panel.matches(":popover-open")) this.panel.hidePopover();
			} else {
				this.panel.classList.remove("is-shown");
			}
		};
		clearTimeout(this.closeTimer);
		if (instant) hide();
		else this.closeTimer = window.setTimeout(hide, 180);
		if (returnFocus) this.trigger.focus({ preventScroll: true });
	}

	private onOutside = (event: PointerEvent): void => {
		if (!this.contains(event.target as Node) && !this.panel.contains(event.target as Node)) this.close(false);
	};

	/** Under the button, its right edge on the button's right edge; above it when there is no room below. */
	private place = (): void => {
		if (!popoverSupported) return;
		const button = this.trigger.getBoundingClientRect();
		// Layout size, not the painted one: while it opens the list is scaled down a little.
		const width = this.panel.offsetWidth;
		const height = this.panel.offsetHeight;
		const below = innerHeight - button.bottom - GAP - EDGE;
		const above = button.top - GAP - EDGE;
		const up = height > below && above > below;
		const left = Math.min(Math.max(EDGE, button.right - width), innerWidth - width - EDGE);
		const top = up ? button.top - GAP - height : button.bottom + GAP;
		this.panel.style.left = `${Math.round(left)}px`;
		this.panel.style.top = `${Math.round(Math.max(EDGE, top))}px`;
		this.panel.style.setProperty("--origin", `${up ? "bottom" : "top"} ${button.right - left > width / 2 ? "right" : "left"}`);
	};

	private setActive(index: number, scroll: boolean): void {
		if (index < 0 || index >= this.options.length) return;
		this.active = index;
		this.options.forEach((option, n) => option.classList.toggle("is-active", n === index));
		this.list.setAttribute("aria-activedescendant", this.options[index]!.id);
		if (scroll) this.options[index]!.scrollIntoView({ block: "nearest" });
	}

	private onKey(event: KeyboardEvent): void {
		const last = this.options.length - 1;
		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				this.setActive(Math.min(last, this.active + 1), true);
				return;
			case "ArrowUp":
				event.preventDefault();
				this.setActive(Math.max(0, this.active - 1), true);
				return;
			case "Home":
				event.preventDefault();
				this.setActive(0, true);
				return;
			case "End":
				event.preventDefault();
				this.setActive(last, true);
				return;
			case "Enter":
			case " ":
				event.preventDefault();
				this.choose(this.active);
				return;
			case "Escape":
				event.preventDefault();
				this.close(true);
				return;
			case "Tab":
				this.close(false);
				return;
		}
		// Type-ahead: letters typed within a moment of each other name an option.
		if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
			const now = Date.now();
			this.typed = now - this.typedAt < 700 ? this.typed + event.key.toLowerCase() : event.key.toLowerCase();
			this.typedAt = now;
			const match = this.options.findIndex((option) => (option.textContent ?? "").trim().toLowerCase().startsWith(this.typed));
			if (match >= 0) this.setActive(match, true);
		}
	}

	private choose(index: number): void {
		const option = this.options[index];
		if (!option) return;
		const value = option.dataset.value ?? "";
		if (this.dataset.kind === "link") {
			const href = option.dataset.href;
			this.close(false, true);
			if (href && option.getAttribute("aria-selected") !== "true") location.assign(href);
			return;
		}
		// A theme: the list goes at once, so the page that the new theme circles out over is clean.
		const button = this.trigger.getBoundingClientRect();
		this.close(true, true);
		chooseTheme(value as ThemeChoice, { x: button.left + button.width / 2, y: button.top + button.height / 2 });
	}

	/** Show a choice made anywhere — here, in another dropdown, in another tab. */
	private reflect(choice: ThemeChoice): void {
		this.dataset.value = choice;
		let chosenLabel = "";
		for (const option of this.options) {
			const on = option.dataset.value === choice;
			option.setAttribute("aria-selected", String(on));
			if (on) chosenLabel = option.querySelector(".dropdown-option-label")?.textContent ?? "";
		}
		const label = this.querySelector("[data-trigger-label]");
		if (label && chosenLabel) label.textContent = chosenLabel;
		if (this.trigger.hasAttribute("aria-label") && chosenLabel) this.trigger.setAttribute("aria-label", `${this.trigger.dataset.label}: ${chosenLabel}`);
	}
}

if (!customElements.get("lyra-dropdown")) customElements.define("lyra-dropdown", LyraDropdown);
