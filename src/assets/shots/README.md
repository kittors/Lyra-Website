# 官网截图

这里的每一张都是 **Lyra 真窗口的截图**：真实的渲染器、真实的智能体循环、真实的工具调用，数据全部虚构。
由 `scripts/capture/capture.ts` 生成：原图先落在 `scripts/capture/out/`（不进仓库），加 `--publish`
时复制到这里，同时复制一份到 `~/Desktop/官网测试/截图/`。

## 规格

- 桌面：窗口 1440×900 逻辑像素，2 倍 → **2880×1800** PNG。只截网页内容，不含系统窗口边框和红绿灯；
  左上角那块空白是给红绿灯留的位置，外框由官网用 CSS 画。
- 手机：390×844 逻辑像素，3 倍 → **1170×2532** PNG。不含状态栏和 Home 指示条，机身由官网画。手机场景里模型显示名
  写作「Sonnet 5」：「Claude Sonnet 5」在手机输入框里会被截成「Claude So…」。
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
| `hero-conversation-{light,dark}[-en].png` | 首屏主图。侧栏 4 个项目、若干会话；主区是智能体在修 `aurora-notes` 的离线同步 bug：用户的问题，「读取文件、创建复现测试、更新清单」一行，「原因」的回答（标题、两条列表、语法高亮代码块、两行表格），展开的一组工具卡（改文件 +2 −3 已完成、`npx vitest run test/sync` **正在运行**），状态行，计划 2/3，输入框和模型选择 Claude Sonnet 5；右侧 Git 面板里是两个文件的 diff。 |
| `split-view-{light,dark}[-en].png` | 两个会话分屏并排：左边是上面那段还在跑测试的对话，右边是同一项目里已完成的「表格里用 Tab 切换单元格」，带列表、代码块和「已编辑 2 个文件」卡片。 |
| `sub-agents-{light,dark}[-en].png` | v0.15.0 发布前检查：主智能体一次派出四个子智能体（跑测试、类型检查、审查同步模块、整理更新日志），三个在跑、一个排队；输入框上方是「3 个子 Agent 运行中 · 1 个排队中」，右侧面板实时显示审查子智能体一步步读代码的过程。 |
| `plugin-market-{light,dark}[-en].png` | 插件市场，数据来自线上真实市场 `market.07230805.xyz`；两个技能包显示「已安装」。 |
| `plugin-detail-{light,dark}[-en].png` | Waza 的详情页：头部信息、安装按钮、渲染好的 README（插画、徽章、技能示意图）。 |
| `schedule-{light,dark}[-en].png` | 「已安排」：每天 / 每隔 N 分钟的定时任务，上次运行、下次运行、跳到上次会话。 |
| `settings-models-{light,dark}[-en].png` | 模型设置：五个供应商（Anthropic、OpenAI、OpenRouter、DeepSeek、Moonshot AI），选中 OpenRouter，模型列表是五家的官方标志；密钥是占位符，显示为圆点。API 格式下是新的提示文案。 |
| `file-preview-{light,dark}[-en].png` | 对话里点开设计文档的链接，右侧渲染出 Markdown：标题、正文、Mermaid 时序图、有序列表。 |
| `workspace-panels-{light,dark}[-en].png` | 对话旁边的内置终端：`git lg` 的提交图和整套测试的彩色输出。 |
| `pull-requests-{light,dark}[-en].png` | 「拉取请求」：等你审查 / 由我创建 / 之前已审查三组，头像、分支、增删行数、检查状态；右侧是 #142 的详情——审查者（已批准 / 已评论）、5 项检查全部通过、标签、渲染好的描述。 |
| `mobile-1-{light,dark}[-en].png` | 手机上发起的对话停在授权：智能体改写了已推送的提交说明，需要强推，请你批准（拒绝 / 以后不再问 / 允许一次）。 |
| `mobile-2-{light,dark}[-en].png` | 手机上的侧栏：项目和会话，等你批准的那条带标记。 |
| `mobile-3-{light,dark}[-en].png` | 在手机上看一段桌面上已完成的对话：标题、表格、Go 代码块。 |

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
`settings-models`、`file-preview`、`workspace-panels`、`pull-requests`、`mobile`。

拍摄时会在屏幕左上角弹出 Lyra 窗口，**别动鼠标**：真实指针经过窗口会带出悬停效果、打断拖拽（脚本在每张之前都会
把指针挪到空白处，但挡不住拍摄那一刻的真鼠标）。调试端口只用 9790–9791。

主图和分屏的取景有硬约束：对话区上下各有一道渐隐（顶 36px、底 48px，只在还能往那边滚时出现），状态行落在底部
渐隐里会发灰。所以脚本把对话滚到最底（没有底部渐隐），再检查问题气泡在顶部渐隐之外，终端里会打印「画面余量」。
**改主图剧本时让余量保持 ≥ 0**，余量为负说明内容太高了。

## 英文界面的替身（Lyra 还有几处没本地化）

英文界面里有几处 Lyra 仍然写死中文。英文截图里用 `scripts/capture/lib/english.ts` 按「修好之后应有的样子」渲染，
只改页面上的显示、不动 Lyra 的文件、只在英文场景生效；`SHOTS_NO_EN_FIXES=1` 可以全部关掉。Lyra 修好一处就删一处：

1. **消息时间**：`features/conversation/MessageActions.tsx` 的 `formatSentAt` 写死 `toLocaleString("zh-CN")`，
   任何语言下都显示「9月26日 14:28」。手机上没有悬停，这一行一直可见。替身把 `"zh-CN"` 换成界面语言（英文里
   显示为「September 26 at 02:40 PM」）。
2. **终端标签**：`electron/terminal-registry.ts` 把每个终端都叫「终端 N」，主进程自己的文案表 `electron/i18n.ts`
   里没有这一条。替身显示为「Terminal N」。
3. **授权卡的风险说明**：`core/src/tools/risk.ts` 里的说明只有中文。替身只翻译了截图里出现的那一句（强制推送）。
4. **工具摘要的分隔符**：`lib/tool-kinds.ts` 用「、」连接一段工作的各部分，英文里也是。替身换成「, 」。

另外，插件市场卡片的图标在深色主题下变空白的问题已在 Lyra 修好（`PluginIcon` 固定 `color-scheme: light`），截图
不再需要注入。

## 拍摄时绕开的其他 Lyra 问题

1. **终端主题慢一拍**：运行中切换主题，终端取到的是切换前的配色。脚本切完主题后再原样保存一次设置，让终端重新取色。
2. **分屏**：把一个正在跑工具的会话放进分屏，那一屏会丢掉实时状态（运行中的命令画成失败）；在分屏里新开的空白对话，
   发出的消息会进到**有焦点**的那个会话；输入框上方的项目名跟的是有焦点的会话。脚本的做法是先建好会话（让模型先
   不回话），再分屏，再放行，两屏用同一个项目。
3. **市场源偶尔读取失败**会在页面顶部留一条红色报错；脚本检测到就点「重新读取」，重试几次仍失败就停下来。
