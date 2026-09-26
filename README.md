<p align="center">
  <img src="src/assets/brand/app-icon.png" alt="Lyra" width="120">
</p>

<h1 align="center">Lyra Website</h1>

<p align="center">
  The source of <a href="https://lyra.07230805.xyz">lyra.07230805.xyz</a> — Lyra's home page, its downloads and its documentation.
  <br>
  <strong>English</strong> · <a href="./README.zh-CN.md">中文</a>
</p>

## What is here

| Path | What it is |
| --- | --- |
| `src/pages/` | The product pages: home and download, in Chinese at `/` and English at `/en/`. |
| `src/content/docs/docs/` | The documentation (Starlight), at `/docs/` and `/en/docs/`. |
| `src/assets/shots/` | Screenshots of the real app, taken by `pnpm capture`. |
| `worker/` | The Cloudflare Worker: the release feed, the downloads and the mirror. |
| `shared/release.ts` | What a release looks like, shared by the pages and the Worker. |

Lyra itself lives in [kittors/Lyra](https://github.com/kittors/Lyra); its plugin market in [kittors/Lyra-Registry](https://github.com/kittors/Lyra-Registry).

## Develop

```bash
pnpm install
pnpm dev          # the site at http://localhost:4321
pnpm check        # types, content and tests
pnpm preview      # the built site and the Worker together, on wrangler dev
```

To add a documentation page, drop a Markdown (or MDX) file into `src/content/docs/docs/<section>/` and its English twin into `src/content/docs/en/docs/<section>/`. The sidebar builds itself; `sidebar.order` in the front matter sets the position.

## Downloads

The download buttons all point at `/dl/<id>` (`/dl/mac-arm64`, `/dl/win-x64`, …). The Worker decides where each click goes:

- **Mainland China** → `dl.07230805.xyz`, an R2 bucket holding a copy of the latest release.
- **Everywhere else** → the file on GitHub Releases.
- `?from=github` or `?from=mirror` overrides the guess.

Nobody uploads to the mirror. The Worker pulls each release from GitHub itself: a cron every ten minutes, and `POST /api/sync`, which Lyra's release workflow calls right after publishing. Each step copies one or a few files, and R2 refuses any file whose SHA-256 differs from the release's `SHA256SUMS`. The release before the latest is kept; older ones are removed once the new one is complete. `GET /api/release` is what the pages read to show the current version.

## Deploy

```bash
pnpm run deploy   # build, then wrangler deploy
```

Pushes to `main` deploy automatically once the repository has a `CLOUDFLARE_API_TOKEN` secret (see `.github/workflows/deploy.yml` for the permissions). The Worker's `SYNC_TOKEN` secret is the one Lyra's release workflow holds as `LYRA_SITE_SYNC_TOKEN`.

## License

[MIT](LICENSE)
