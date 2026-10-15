# 官网截图

这里的每一张都是 **Lyra 真窗口的截图**：真实的渲染器、真实的智能体循环、真实的工具调用，数据全部虚构。
由 `scripts/capture/capture.ts` 生成：原图先落在 `scripts/capture/out/`（不进仓库），加 `--publish`
时复制到这里，同时复制一份到 `~/Desktop/官网测试/截图/`。

## 规格

- 桌面：窗口 1440×900 逻辑像素，2 倍 → **2880×1800** PNG。只截网页内容，不含系统窗口边框和红绿灯；
  顶上 40px 工具栏最左边那块空白是给红绿灯留的位置，外框和红绿灯由官网用 CSS 画（`WindowFrame.astro`，
  灯的位置跟着 Lyra 主窗口的 `trafficLightPosition`：向内 16pt、向下 13pt）。
- 拍摄时关掉 macOS 毛玻璃（`appearance.vibrancy: false`）：开着时侧栏是透明的，网页截图里那块后面什么都没有。
- 手机：390×844 逻辑像素，3 倍 → **1170×2532** PNG，就是整块屏幕。拍摄时给页面注入 `--ly-native-top: 47px`、
  `--ly-native-bottom: 34px`（手机原生壳平时就是这样告诉页面的），页面自己把顶部 47pt 和底部 34pt 留空；官网的
  `PhoneFrame` 把截图铺满屏幕，状态栏和 Home 指示条正好画在这两条空白上，不会压到任何控件。
- 命名：`<场景>-<light|dark>.png`，英文界面加 `-en`（`<场景>-<light|dark>-en.png`）。手机也一样：
  `mobile-<n>-light[-en].png` / `mobile-<n>-dark[-en].png`——`src/lib/shots.ts` 先按主题、再按语言找图，
  裸名 `mobile-<n>.png` 在浅色页面上会输给深色那张。
- 每个场景都有中文和英文、浅色和深色四张（`plugin-*` 的英文版里，卡片描述和分类仍是中文：市场数据只有中文）。
- 同一场景的浅色、深色是**同一个窗口里切主题**拍的：内容、滚动位置、计时读数完全一致（脚本会比对两张上的文字，
  不一致就重拍）。
- 中文版的对话、任务名、文件内容是中文，英文版是英文；项目代码和 README 两种语言都是英文，和真实的开源仓库一样。

## 每张图

| 文件 | 画面 |
| --- | --- |
| `hero-conversation-{light,dark}[-en].png` | 首屏主图。顶上是工具栏，最左边是图标栏；侧栏 4 个项目、若干会话；主区是智能体在修 `aurora-notes` 的离线同步 bug：用户的问题，收成一行的第一段工作（「读取文件 merge.ts、创建文件 merge.test.ts、更新清单」），「原因」的回答（标题、两条列表、语法高亮代码块、两行表格），展开的第二段工作（修改文件 merge.ts +2 −3、`npx vitest run test/sync` **正在运行**），状态行，计划 2/3，输入框和模型选择 Claude Sonnet 5；右侧 Git 面板里是两个文件的 diff。 |
| `split-view-{light,dark}[-en].png` | 两个会话分屏并排，各有自己的标题栏和面板按钮：左边是上面那段还在跑测试的对话，右边是同一项目里已完成的「表格里用 Tab 切换单元格」，带列表、代码块和「已编辑 2 个文件」卡片。 |
| `sub-agents-{light,dark}[-en].png` | v0.15.0 发布前检查：主智能体一次派出四个子智能体（跑测试、类型检查、审查同步模块、整理更新日志），三个在跑、一个排队；展开的那一段里每个子智能体一行，带着它的头像；输入框上方是「3 个子 Agent 运行中 · 1 个排队中」，右侧面板实时显示审查子智能体一步步读代码的过程。 |
| `plugin-market-{light,dark}[-en].png` | 插件市场，数据来自线上真实市场 `market.07230805.xyz`；两个技能包显示「已安装」。**仍是 09-27 的旧外框**：10-12 重拍时本机连不上市场（TLS 握手被断开），待网络恢复后重拍。 |
| `plugin-detail-{light,dark}[-en].png` | Waza 的详情页：头部信息、安装按钮、渲染好的 README（插画、徽章、技能示意图）。同上，仍是旧外框。 |
| `schedule-{light,dark}[-en].png` | 「已安排」：每天 / 每隔 N 分钟的定时任务，上次运行、下次运行、跳到上次会话。 |
| `settings-models-{light,dark}[-en].png` | 模型设置：五个供应商（Anthropic、OpenAI、OpenRouter、DeepSeek、Moonshot AI），选中 OpenRouter：「连接」卡片（Base URL、API 格式、API Key）和「模型」卡片，五个模型是五家的官方标志；密钥是占位符，显示为圆点。 |
| `file-preview-{light,dark}[-en].png` | 对话里点开设计文档的链接，右侧渲染出 Markdown：标题、正文、Mermaid 时序图、有序列表。 |
| `image-generation-{light,dark}[-en].png` | 对话里画图：在 `aurora-notes` 里给空笔记页画插画。上面一张已经画好，下面是照着它画的两张夜景、正画到一半：点阵占着图的位置，上方写着画到哪一步，角上是百分比。 |
| `studio-{light,dark}[-en].png` | 「创作」：八张真实模型画的图按天排开——今天是竖版和横版的极光、黄昏的纸船，昨天是同一只纸船的冬夜、月夜和清晨，往下是三天前的两版 `orbit-cli` 图标（被底边裁到一半）。同一条链路上的图角上写着几步：纸船 4，极光 2。 |
| `studio-detail-{light,dark}[-en].png` | 在「创作」里点开冬夜那张：左边大图和「想怎么改」的输入框；右边是对话名、时间和项目，4 步的生成链路（清晨 → 月夜 → 冬夜用强调色，黄昏那条分支接回清晨），提示词，模型、尺寸、比例、清晰度、耗时。 |
| `video-generation-{light,dark}[-en].png` | 做视频：在纸船那个对话里说「把黄昏那张做成 6 秒的视频」，视频还在做——按 16:9 占好位置的点阵，上方「生成中 · 已等 1m 13s」，角上是百分比。 |
| `credential-card-{light,dark}[-en].png` | 对话里的凭据卡片：模型要登上 `atlas-api` 的 staging 服务器，向你要 deploy 账号的密码。用途、「密码 · 只能用于 ssh://deploy@staging.atlas-api.dev」、密码框、拒绝 / 存进保险箱 / 提交，还有剩余时间。 |
| `vault-{light,dark}[-en].png` | 保险箱：四类凭据各一项（SSH 密钥、令牌、账号密码、密码），每行写着名称、类别和只能用于哪里。 |
| `workspace-panels-{light,dark}[-en].png` | 对话旁边的内置终端：`git lg` 的提交图和整套测试的彩色输出。 |
| `pull-requests-{light,dark}[-en].png` | 「拉取请求」：等你审查 / 由我创建 / 之前已审查三组，头像、分支、增删行数、检查状态；右侧是 #142 的详情——审查者（已批准 / 已评论）、5 项检查全部通过、标签、渲染好的描述。 |
| `mobile-1-{light,dark}[-en].png` | 手机上发起的对话停在授权：智能体改写了已推送的提交说明，需要强推，请你批准（拒绝 / 以后不再问 / 允许一次）。官网放在中间。 |
| `mobile-2-{light,dark}[-en].png` | 侧栏里长按那条等你批准的会话：页面变暗模糊，这一行浮起来，旁边弹出置顶、重命名、归档、项目、复制、打开方式。官网放在左边。 |
| `mobile-3-{light,dark}[-en].png` | 新对话的空态：吉祥物、「要在 aurora-notes 内开发什么？」、可横向滑动的建议，输入框里是完整的模型名。官网放在右边。 |

## 数据是假的

- 截图时应用跑在一个**临时 home** 里：`~/Projects` 下四个手写的小仓库（`aurora-notes`、`atlas-api`、`lumen-ui`、
  `orbit-cli`），有 git 历史和一个指向本地裸仓库、看起来像 GitHub 的远端。开发者叫 Maya Chen（`mayachen`），
  邮箱 `maya@aurora-notes.dev`，拉取请求里的同事也都是虚构的，头像是脚本画的 identicon。
- 不读用户真实的 `~/.lyra`、`~/.claude`、`~/.gitconfig`：`HOME`、`ZDOTDIR` 指向临时 home，Claude / Anthropic 等
  相关的环境变量在启动前清掉。终端提示符只显示 `~/Projects/<项目>`，没有用户名和主机名。
- **每一张在保存前都过一遍隐私检查**（`scripts/capture/lib/privacy.ts`）：页面文字和输入框的值里只要出现本机真实
  的 home 路径、系统临时目录、主机名或 git 邮箱，这张就直接失败，不会落盘。这些标记在运行时从本机读取，不写进仓库。
- 模型是脚本化的假服务（Anthropic Messages 流式协议），只替模型「做决定」；读文件、改文件、算 diff、跑命令都是
  Lyra 自己的工具真做的。`npx vitest`、`npx tsc` 是项目里的假命令，输出仿照真实工具。
- 画图场景的生图模型配在一个指向本机的供应商下（`scripts/capture/lib/images.ts`）：它照 OpenAI Images 接口回图，
  回的是 Lyra 自己测试用的两张图（`packages/desktop/e2e/assets/image-gen-{day,night}.jpg`）。
- **「创作」和做视频里的图是真的**：`scripts/capture/art/generate.ts` 用真实的生图模型画过一次（纸船和极光是
  `gemini-3.1-flash-image`，图标是 `grok-imagine-image-quality`），连同提示词、尺寸存在 `scripts/capture/assets/`
  里提交。拍摄时不调用任何模型：画过这些图的三个对话按 Lyra 记录的格式写进会话（`scripts/capture/lib/drawings.ts`），
  生成链路靠结果里的 `sources` 连起来，时间分在今天、昨天和三天前。重画要用自己 Lyra 里配好的这两个模型，会计费。
- 做视频那张没有成片：手上的 xAI 账号开了 Zero Data Retention，这种团队生成视频必须给 `output.upload_url`，Lyra
  不发这个参数。所以拍的是视频还在做的样子，xAI 的视频接口由本机一个一直回答 pending 的服务代替（`lib/videos.ts`）。
- 保险箱里的值全是占位符，页面也从不显示值；那把 SSH 私钥每次拍摄现做，拍完就丢。
- 拉取请求页连的是本机一个假的 GitHub Enterprise（`/api/v3/user`、`/api/graphql`、diff 接口），应用按真实 GitHub
  账号的方式查询它。
- 时间：应用跑在一个此刻正好是下午的时区里，时间戳不会出现深夜的「0:01」。
- 「已安排」页会打印任务的完整目录，任务目录写成故事里的 `/Users/mayachen/Projects/…`（截图时这些任务都不会运行）。

## 重拍

前提：Node 24；Lyra 仓库在旁边（或用 `LYRA_DIR` 指过去）并且已构建；插件两张需要能访问线上市场。

```bash
# 1. 构建 Lyra（截图跑的是 out/ 里的产物）
cd ../Lyra/packages/desktop && pnpm build

# 2. 回到官网仓库拍
cd ../../../Lyra-Website
node scripts/capture/capture.ts --publish                 # 全部场景、中英文，拍完放进这里和桌面（约 15 分钟）
node scripts/capture/capture.ts                           # 只拍到 scripts/capture/out/，先看再说
node scripts/capture/capture.ts hero-conversation         # 单个场景（中英文）
node scripts/capture/capture.ts --lang en                 # 只拍英文
node scripts/capture/capture.ts mobile --lang zh          # 单个场景、单个语言
LYRA_DIR=/path/to/Lyra node scripts/capture/capture.ts    # Lyra 不在旁边时
```

场景名：`hero-conversation`、`split-view`、`sub-agents`、`plugin-market`、`plugin-detail`、`schedule`、
`settings-models`、`file-preview`、`image-generation`、`studio`、`video-generation`、`vault`、`workspace-panels`、
`pull-requests`、`mobile`。

「创作」和做视频用的图要换的话，先重画再拍：

```bash
node scripts/capture/art/generate.ts            # 用你 Lyra 里的生图模型重画全部（计费）
node scripts/capture/art/generate.ts icon       # 只重画一组：boat、aurora、icon
```

拍摄时会在屏幕左上角弹出 Lyra 窗口，**别动鼠标**：真实指针经过窗口会带出悬停效果、打断拖拽（脚本在每张之前都会
把指针挪到空白处，但挡不住拍摄那一刻的真鼠标）。调试端口只用 9790–9792（重画图用 9792）。

主图和分屏的取景有硬约束：对话区上下各有一道渐隐（顶 36px、底 48px，只在还能往那边滚时出现），状态行落在底部
渐隐里会发灰。所以脚本把对话滚到最底（没有底部渐隐），再检查问题气泡在顶部渐隐之外，终端里会打印「画面余量」。
**改主图剧本时让余量保持 ≥ 0**，余量为负说明内容太高了。

## 拍摄时绕开的 Lyra 问题

以前绕开的几处——英文界面里写死的中文（消息时间、终端标签、风险说明、工具摘要的「、」）、终端主题慢一拍、
分屏丢实时状态和项目行跟着焦点走——都已在 Lyra 修好，对应的替身和绕行已经删掉。现在只剩一处：

- **市场源偶尔读取失败**会在页面顶部留一条红色报错；脚本检测到就点「重新读取」，重试几次仍失败就停下来。读市场
  索引（装两个技能包要用）也会重试几次。
