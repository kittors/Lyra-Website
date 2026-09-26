/**
 * Copy buttons (`CopyButton.astro`): the value in `data-copy`, or the current text of the element
 * named by `data-copy-from`. The label says it worked for a moment, then goes back.
 */

async function write(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		// Denied, or not a secure context (a plain-http preview): leave the label alone rather than lie.
		return false;
	}
}

export function wireCopyButtons(): void {
	const timers = new WeakMap<HTMLElement, number>();
	document.addEventListener("click", async (event) => {
		const button = (event.target as Element | null)?.closest<HTMLElement>("[data-copy], [data-copy-from]");
		if (!button) return;
		const from = button.dataset.copyFrom ? document.getElementById(button.dataset.copyFrom) : null;
		const text = (button.dataset.copy ?? from?.textContent ?? "").replace(/\s+/g, " ").trim();
		if (!text || !(await write(text))) return;
		const label = button.querySelector(".copy-label");
		button.dataset.copied = "";
		if (label) label.textContent = button.dataset.done ?? "";
		clearTimeout(timers.get(button));
		timers.set(
			button,
			window.setTimeout(() => {
				delete button.dataset.copied;
				if (label) label.textContent = button.dataset.label ?? "";
			}, 1800),
		);
	});
}
