/**
 * Writes `src/data/release-snapshot.json`: the release a build falls back on when GitHub does not
 * answer. Run it after a release if the build machine is often offline — otherwise the snapshot only
 * ever paints a first frame that the Worker's answer replaces.
 *
 *     node scripts/snapshot-release.ts
 */

import { writeFile } from "node:fs/promises";

import { fetchLatestRelease } from "../src/lib/release-fetch.ts";
import { isRelease } from "../src/lib/release-shape.ts";

const release = await fetchLatestRelease({ token: process.env.GITHUB_TOKEN });
if (!isRelease(release)) throw new Error(`The latest release (${release.tag}) has no installers the site offers.`);

const target = new URL("../src/data/release-snapshot.json", import.meta.url);
await writeFile(target, `${JSON.stringify(release, null, "\t")}\n`);
console.log(`Snapshot: ${release.tag}, ${release.assets.length} installers, ${release.assets.filter((asset) => asset.sha256).length} with digests.`);
