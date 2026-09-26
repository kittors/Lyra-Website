# 官网截图

这里的每一张都是 **Lyra 真窗口的截图**：真实的渲染器、真实的智能体循环、真实的工具调用，数据全部虚构。
由 `scripts/capture/capture.ts` 生成：原图先落在 `scripts/capture/out/`（不进仓库），加 `--publish`
时复制到这里，同时复制一份到 `~/Desktop/官网测试/截图/`。

## 规格

- 桌面：窗口 1440×900 逻辑像素，2 倍 → **2880×1800** PNG。只截网页内容，不含系统窗口边框和红绿灯；
  左上角那块空白是给红绿灯留的位置，外框由官网用 CSS 画。
- 手机：390×844 逻辑像素，3 倍 → **1170×2532** PNG。不含状态栏和 Home 指示条，机身由官网画。手机场景里模型显示名
  写作「Sonnet 5」：「Claude Sonnet 5」在手机输入框里会被截成「Claude So…」。
- 命名：`<场景>-<light|dark>.png`，英文界面加 `-en`。手机也一样：`mobile-<n>-light.png` / `mobile-<n>-dark.png`
  （`src/lib/shots.ts` 按主题找图，裸名 `mobile-<n>.png` 在浅色页面上会输给深色那张）。
- 同一场景的浅色、深色是**同一个窗口里切主题**拍的：内容、滚动位置、计时读数完全一致（脚本会比对两张上的文字，
  不一致就重拍）。

## 每张图

| 文件 | 画面 |
| --- | --- |
| `hero-conversation-{light,dark}[-en].png` | 首屏主图。侧栏 4 个项目、若干会话；主区是智能体在修 `aurora-notes` 的离线同步 bug：用户的问题，「读取文件、创建复现测试、更新清单」一行，「原因」的回答（标题、两条列表、语法高亮代码块、两行表格），展开的一组工具卡（改文件 +2 −3 已完成、`npx vitest run test/sync` **正在运行**），状态行，计划 2/3，输入框和模型选择 Claude Sonnet 5；右侧 Git 面板里是两个文件的 diff。 |
| `split-view-{light,dark}[-en].png` | 两个会话分屏并排：左边是上面那段还在跑测试的对话，右边是同一项目里已完成的「表格里用 Tab 切换单元格」，带列表、代码块和「已编辑 2 个文件」卡片。 |
| `sub-agents-{light,dark}[-en].png` | v0.15.0 发布前检查：主智能体一次派出四个子智能体（跑测试、类型检查、审查同步模块、整理更新日志），三个在跑、一个排队；输入框上方是「3 个子 Agent 运行中 · 1 个排队中」，右侧面板实时显示审查子智能体一步步读代码的过程。 |
| `plugin-market-{light,dark}[-en].png` | 插件市场，数据来自线上真实市场 `market.07230805.xyz`；两个技能包显示「已安装」。市场本身只有中文描述和中文分类，所以英文界面里卡片文字仍是中文。 |
| `plugin-detail-{light,dark}.png` | Waza 的详情页：头部信息、安装按钮、渲染好的 README（插画、徽章、技能示意图）。 |
| `schedule-{light,dark}.png` | 「已安排」：每天 / 每隔 N 分钟的定时任务，上次运行、下次运行、跳到上次会话。 |
| `settings-models-{light,dark}.png` | 模型设置：五个供应商（Anthropic、OpenAI、OpenRouter、DeepSeek、Moonshot AI），选中 OpenRouter，模型列表是五家的官方标志；密钥是占位符，显示为圆点。API 格式下的提示是新文案（「按供应商文档选……」）。 |
| `file-preview-{light,dark}.png` | 对话里点开设计文档的链接，右侧渲染出 Markdown：标题、正文、Mermaid 时序图、有序列表。 |
| `workspace-panels-{light,dark}.png` | 对话旁边的内置终端：`git lg` 的提交图和整套测试的彩色输出。 |
| `pull-requests-{light,dark}.png` | 「拉取请求」：等你审查 / 由我创建 / 之前已审查三组，头像、分支、增删行数、检查状态；右侧是 #142 的详情——审查者（已批准 / 已评论）、5 项检查全部通过、标签、渲染好的描述。 |
| `mobile-1-{light,dark}.png` | 手机上发起的对话停在授权：智能体改写了已推送的提交说明，需要强推，请你批准（拒绝 / 以后不再问 / 允许一次）。 |
| `mobile-2-{light,dark}.png` | 手机上的侧栏：项目和会话，等你批准的那条带标记。 |
| `mobile-3-{light,dark}.png` | 在手机上看一段桌面上已完成的对话：标题、表格、Go 代码块。 |

## 数据是假的

- 截图时应用跑在一个**临时 home** 里：`~/Projects` 下四个手写的小仓库（`aurora-notes`、`atlas-api`、`lumen-ui`、
  `orbit-cli`），有 git 历史和一个指向本地裸仓库、看起来像 GitHub 的远端。开发者叫 Maya Chen（`mayachen`），
  邮箱 `maya@aurora-notes.dev`，拉取请求里的同事也都是虚构的，头像是脚本画的 identicon。
- 不读用户真实的 `~/.lyra`、`~/.claude`、`~/.gitconfig`：`HOME`、`ZDOTDIR` 指向临时 home，Claude / Anthropic 等
  相关的环境变量在启动前清掉。终端提示符只显示 `~/Projects/<项目>`，没有用户名和主机名。
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
node scripts/capture/capture.ts --publish                 # 全部场景、全部语言，拍完放进这里和桌面（约 9 分钟）
node scripts/capture/capture.ts                           # 只拍到 scripts/capture/out/，先看再说
node scripts/capture/capture.ts hero-conversation         # 单个场景
node scripts/capture/capture.ts --lang en                 # 只拍英文
LYRA_DIR=/path/to/Lyra node scripts/capture/capture.ts    # Lyra 不在旁边时
```

场景名：`hero-conversation`、`split-view`、`sub-agents`、`plugin-market`、`plugin-detail`、`schedule`、
`settings-models`、`file-preview`、`workspace-panels`、`pull-requests`、`mobile`。

拍摄时会在屏幕左上角弹出 Lyra 窗口，**别动鼠标**：真实指针经过窗口会带出悬停效果、打断拖拽（脚本在每张之前都会
把指针挪到空白处，但挡不住拍摄那一刻的真鼠标）。调试端口只用 9790–9791。

主图和分屏的取景有硬约束：对话区上下各有一道渐隐（顶 36px、底 48px，只在还能往那边滚时出现），状态行落在底部
渐隐里会发灰。所以脚本把对话滚到最底（没有底部渐隐），再检查问题气泡在顶部渐隐之外，终端里会打印「画面余量」。
**改主图剧本时让余量保持 ≥ 0**，余量为负说明内容太高了。

## 拍摄时绕开的 Lyra 问题

这些都在截图脚本里有注释，Lyra 修好之后可以去掉对应的绕行：

1. **市场卡片的深色图标**：个别图标 SVG 带 `prefers-color-scheme: dark` 时变白，而 Lyra 把它放在白色底块上，深色主题下
   是一块空白（例：Matt Pocock Skills）。脚本给卡片图标加了 `color-scheme: light`，这正是 Lyra 该改的那一行；
   `SHOTS_NO_LOGO_FIX=1` 可关掉。
2. **终端主题慢一拍**：运行中切换主题，终端取到的是切换前的配色。脚本切完主题后再原样保存一次设置，让终端重新取色。
3. **分屏**：把一个正在跑工具的会话放进分屏，那一屏会丢掉实时状态（运行中的命令画成失败）；在分屏里新开的空白对话，
   发出的消息会进到**有焦点**的那个会话；输入框上方的项目名跟的是有焦点的会话。脚本的做法是先建好会话（让模型先
   不回话），再分屏，再放行，两屏用同一个项目。
4. **英文界面的工具摘要用中文顿号**：「Read files merge.ts、Created files …」，是 `lib/tool-kinds.ts` 里写死的
   `join("、")`。截图里照实保留。
5. **市场源偶尔读取失败**会在页面顶部留一条红色报错；脚本检测到就点「重新读取」，重试几次仍失败就停下来。
