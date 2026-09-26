<p align="center">
  <img src="src/assets/brand/app-icon.png" alt="Lyra" width="120">
</p>

<h1 align="center">Lyra 官网</h1>

<p align="center">
  <a href="https://lyra.07230805.xyz">lyra.07230805.xyz</a> 的源码：Lyra 的首页、下载和文档。
  <br>
  <a href="./README.md">English</a> · <strong>中文</strong>
</p>

## 目录

| 路径 | 内容 |
| --- | --- |
| `src/pages/` | 产品页：首页和下载页。中文在 `/`，英文在 `/en/`。 |
| `src/content/docs/docs/` | 文档（Starlight），地址是 `/docs/` 和 `/en/docs/`。 |
| `src/assets/shots/` | 真实应用截图，由 `pnpm capture` 拍摄。 |
| `worker/` | Cloudflare Worker：版本信息、下载跳转和镜像。 |
| `shared/release.ts` | 发版数据的形状，页面和 Worker 共用。 |

Lyra 本体在 [kittors/Lyra](https://github.com/kittors/Lyra)，插件市场在 [kittors/Lyra-Registry](https://github.com/kittors/Lyra-Registry)。

## 开发

```bash
pnpm install
pnpm dev          # 站点在 http://localhost:4321
pnpm check        # 类型、内容和测试
pnpm preview      # 构建后的站点加 Worker，一起跑在 wrangler dev 上
```

加一篇文档：把 Markdown（或 MDX）文件放进 `src/content/docs/docs/<分组>/`，英文版放进 `src/content/docs/en/docs/<分组>/`。侧栏会自动生成，位置由 front matter 的 `sidebar.order` 决定。

## 下载

所有下载按钮都指向 `/dl/<id>`（如 `/dl/mac-arm64`、`/dl/win-x64`），由 Worker 决定每次点击去哪里：

- **中国大陆** → `dl.07230805.xyz`，一个存放最新版本副本的 R2 存储桶。
- **其他地区** → GitHub Releases 上的原文件。
- 加 `?from=github` 或 `?from=mirror` 可以手动指定。

镜像不靠人上传，由 Worker 自己从 GitHub 拉取：每十分钟一次定时任务；另外，Lyra 的发版工作流发布完成后会立刻调用 `POST /api/sync`。每一步复制一到几个文件，R2 会拒收任何 SHA-256 与发版 `SHA256SUMS` 不一致的文件。镜像保留最新版和上一版，更早的版本在新版完整复制后删除。页面通过 `GET /api/release` 显示当前版本。

## 部署

```bash
pnpm run deploy   # 构建后执行 wrangler deploy
```

仓库配置了 `CLOUDFLARE_API_TOKEN` 密钥后，推送到 `main` 会自动部署（所需权限见 `.github/workflows/deploy.yml`）。Worker 的 `SYNC_TOKEN` 密钥，在 Lyra 的发版工作流里对应 `LYRA_SITE_SYNC_TOKEN`。

## 许可证

[MIT](LICENSE)
