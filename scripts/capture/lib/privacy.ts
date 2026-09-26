/**
 * What must never appear in a published screenshot, read from this machine at start-up.
 *
 * The scenes run on a made-up home, so none of these should ever reach the window. This is the net
 * under that: every capture's text — what the page says, and the values in its fields — is checked
 * against them, and a capture that contains one fails instead of being saved. The markers are read
 * here, at run time, and never written anywhere; a failure names which kind matched, not its value.
 */

import { execFileSync } from "node:child_process";
import { hostname, tmpdir, userInfo } from "node:os";

interface Marker {
	what: string;
	value: string;
}

function read(): Marker[] {
	const markers: Marker[] = [];
	const home = userInfo().homedir;
	if (home && home.length > 3) markers.push({ what: "真实的 home 路径", value: home });
	markers.push({ what: "系统临时目录", value: "/var/folders/" });
	markers.push({ what: "截图用的临时目录", value: "lyra-shots-" });
	markers.push({ what: "e2e 的临时 profile", value: "lyra-e2e-" });
	const temp = tmpdir();
	if (!temp.startsWith("/var/folders/") && temp.length > 5) markers.push({ what: "系统临时目录", value: temp });
	const host = hostname().replace(/\.local$/, "");
	if (host.length > 3) markers.push({ what: "本机主机名", value: host });
	try {
		const email = execFileSync("git", ["config", "--global", "--get", "user.email"], { encoding: "utf8", env: { ...process.env, HOME: home } }).trim();
		if (email.includes("@")) markers.push({ what: "真实的 git 邮箱", value: email });
	} catch {
		// No global email configured: nothing to look for.
	}
	return markers;
}

/** Read once, before any scene points HOME at the made-up machine. */
const MARKERS = read();

/** The first marker `text` contains, or null. */
export function privateMarkerIn(text: string): string | null {
	const found = MARKERS.find((marker) => text.includes(marker.value));
	return found ? found.what : null;
}
