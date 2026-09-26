import type { Scene } from "../lib/shots.ts";
import type { Locale } from "./index.ts";

/**
 * The home page's words. Short on purpose: every section makes one claim, and every claim is
 * something Lyra actually does (checked against its README and guides, not guessed).
 */

const zh = {
	hero: {
		name: "Lyra",
		/** Rises clause by clause; wraps between clauses on a narrow screen. */
		tagline: "智能体，自成一体。",
		lead: "从零实现的独立 AI 智能体。模型由你来配，桌面与手机共用一份会话。",
		download: "下载",
		github: "GitHub",
		version: (version: string) => `最新版本 v${version}，免费开源`,
		shotAlt: "Lyra 的对话窗口：左侧是项目与会话，右侧是正在进行的对话。",
	},
	kernel: {
		eyebrow: "独立内核",
		title: "不是外壳。",
		lead: "智能体循环、工具、技能与 MCP，全部从零写起。底下没有 Claude Code，也没有 Codex。",
		toolsLabel: "个内置工具",
		toolGroups: [
			{ name: "文件与代码", tools: ["read", "write", "edit", "ls", "glob", "grep", "symbol", "lsp"] },
			{ name: "执行命令", tools: ["bash", "bash_output"] },
			{ name: "会话与记忆", tools: ["todo_write", "task", "skill", "rule", "recall", "learn", "ask_user"] },
			{ name: "网络与预览", tools: ["web_fetch", "web_search", "preview"] },
		],
		modelsTitle: "模型，你说了算。",
		modelsLead: "供应商想加几个就加几个，每个下面挂任意多个模型。三种接口格式都支持。",
		/** The three API formats, each with where it is usually the right choice. */
		protocols: [
			{ name: "Responses", hint: "OpenAI 官方" },
			{ name: "Anthropic Messages", hint: "Anthropic" },
			{ name: "Chat Completions", hint: "其他 OpenAI 兼容服务" },
		],
		shotAlt: "Lyra 的模型设置：供应商列表与每个供应商下的模型。",
	},
	split: {
		eyebrow: "分屏多会话",
		title: "几个会话，一扇窗。",
		lead: "最多四个会话并排，每一屏都有自己的工具面板。空间紧了就紧凑排布，不会突然弹出新窗口。",
		shotAlt: "Lyra 的分屏：几个会话在同一个窗口里并排。",
	},
	agents: {
		eyebrow: "并行子智能体",
		title: "分头去做，带回结论。",
		lead: "task 把工作交给拥有独立上下文的子智能体。过程留在它们那里，只有结论回到主对话。",
		builtins: ["general", "explore", "review", "verify", "plan", "simple", "reason"],
		builtinsNote: "内置七种，也能在 .lyra/agents 里自己写。",
		lanesTitle: "3 个子智能体并行中",
		/** The three the sub-agent screenshot shows running, as they finish. */
		lanes: [
			{ agent: "verify", done: "测试全部通过" },
			{ agent: "verify", done: "类型检查通过" },
			{ agent: "review", done: "找到 2 处问题" },
		],
		lanesDone: "结论已带回主对话",
		shotAlt: "Lyra 的子智能体面板：每个子智能体在做什么。",
	},
	market: {
		eyebrow: "插件市场",
		title: "装上，就会。",
		lead: "技能、插件与 MCP 服务，一处浏览，一键安装。技能用到时才载入，装几十个也不占上下文。",
		countLabel: "个技能、插件与 MCP 服务，还在增加",
		link: "逛逛插件市场",
		wallLabel: "插件市场里的部分条目",
		shotAlt: "Lyra 的插件市场：按分类浏览技能、插件与 MCP 服务。",
		detailAlt: "插件市场里一个条目的详情页。",
	},
	workspace: {
		eyebrow: "工作区",
		title: "工作，就在对话旁边。",
		steps: [
			{ title: "文件预览", body: "文件在对话旁边打开。代码高亮，Markdown 连 mermaid 图一起渲染。", scene: "file-preview" as Scene, alt: "Lyra 的文件预览：对话旁打开的代码文件。" },
			{ title: "九个面板", body: "终端、文件、Git、浏览器、子 Agent……想开几个开几个，随手拖动。", scene: "workspace-panels" as Scene, alt: "Lyra 的工作区面板：终端、Git 等同时打开。" },
			{ title: "定时任务", body: "每天九点查一遍依赖漏洞？设好时间，它自己开新会话去做。", scene: "schedule" as Scene, alt: "Lyra 的定时任务：每天或每隔一段时间自动运行的提示词。" },
		],
		/** As the app words it: the title is Lyra, the body the session's title and that it finished. */
		notice: { app: "Lyra", body: "「依赖安全巡检」已完成", time: "现在" },
	},
	mobile: {
		eyebrow: "手机端",
		title: "桌面上开始，手机上接着聊。",
		lead: "手机重放同一份会话记录：看进行中的回合、批准操作、继续追问。模型和密钥始终留在你的电脑上。",
		paths: [
			{ icon: "wifi", title: "同一个 Wi-Fi", body: "直连，最快。" },
			{ icon: "link", title: "你自己的域名", body: "经你的域名与 TLS。" },
			{ icon: "relay", title: "中转", body: "两端都连不到对方时，在中转碰头。" },
		],
		synced: "已与桌面同步",
		phoneAlt: "Lyra 的手机端。",
		desktopAlt: "桌面端的同一个会话。",
		approvalAlt: "手机上的 Lyra 在等你批准一条命令：拒绝、以后不再问、允许一次。",
		listAlt: "手机上的项目与会话列表，等你批准的那条带着标记。",
		readingAlt: "在手机上读一段桌面上已完成的对话。",
	},
	open: {
		eyebrow: "MIT 许可",
		title: "开源，全平台。",
		lead: "每一行代码都在 GitHub 上。每个版本都带齐 macOS、Windows、Linux、Android 与 iOS。",
		github: "在 GitHub 上查看",
		downloads: "全部下载",
		platforms: "支持的平台",
		fromSource: "从源码运行",
	},
	bento: {
		title: "还有更多。",
		permissions: { title: "三档权限", body: "请求批准、帮我批准、完全访问。在输入框旁随时切换。", modes: ["请求批准", "帮我批准", "完全访问"] },
		context: { title: "上下文，一眼看清", body: "输入框里的圆环显示用了多少，点开是分项。" },
		awake: { title: "任务在跑，电脑不睡", body: "通用设置里的一个开关。合上盖子照常休眠。" },
		sidechat: { title: "侧边聊天", body: "在旁边另开一个对话。读得到主会话，一个字也不写进去。", ask: "刚才那个报错是什么意思？", answer: "配置里少了一个字段……" },
		mcp: { title: "MCP", body: "三种传输都支持，工具名带着服务名，不会撞车。" },
		browser: { title: "内置浏览器", body: "智能体操作的，就是你眼前这张网页。", url: "market.07230805.xyz", button: "安装" },
		skills: { title: "技能按需载入", body: "只有名称和描述进提示词，正文用到时才注入。装几十个也不烧上下文。" },
		format: { title: "内置格式化", body: "一键格式化，也可以设为保存时自动。项目里的 .prettierrc、.editorconfig 优先。" },
		notify: { title: "完成了，会告诉你", body: "窗口不在前台时，任务完成会发系统通知。" },
	},
	cta: {
		title: "把 Lyra 带回家。",
		lead: "免费下载。macOS、Windows、Linux、Android 与 iOS 都有。",
		download: "下载 Lyra",
		docs: "阅读文档",
		mascotAlt: "Lyra 的吉祥物：抱着白兔的蓝发女孩。",
	},
};

type HomeText = typeof zh;

const en: HomeText = {
	hero: {
		name: "Lyra",
		tagline: "An agent of its own.",
		lead: "A standalone AI agent, built from scratch. Bring your own models, and carry every session from desktop to phone.",
		download: "Download",
		github: "GitHub",
		version: (version: string) => `Version ${version}. Free and open source.`,
		shotAlt: "Lyra’s chat window: projects and sessions on the left, a conversation in progress on the right.",
	},
	kernel: {
		eyebrow: "Built from scratch",
		title: "Not a wrapper.",
		lead: "The agent loop, the tools, skills, and MCP are all written from the ground up. There is no Claude Code or Codex underneath.",
		toolsLabel: "built-in tools",
		toolGroups: [
			{ name: "Files and code", tools: ["read", "write", "edit", "ls", "glob", "grep", "symbol", "lsp"] },
			{ name: "Commands", tools: ["bash", "bash_output"] },
			{ name: "Session and memory", tools: ["todo_write", "task", "skill", "rule", "recall", "learn", "ask_user"] },
			{ name: "Network and preview", tools: ["web_fetch", "web_search", "preview"] },
		],
		modelsTitle: "Your models. Your keys.",
		modelsLead: "Add as many providers as you like, with as many models on each. All three API formats work.",
		protocols: [
			{ name: "Responses", hint: "OpenAI’s own API" },
			{ name: "Anthropic Messages", hint: "Anthropic" },
			{ name: "Chat Completions", hint: "Other OpenAI-compatible services" },
		],
		shotAlt: "Lyra’s model settings: providers, and the models on each.",
	},
	split: {
		eyebrow: "Split view",
		title: "Several conversations. One window.",
		lead: "Keep up to four sessions side by side, each with its own tools. When space runs short, they squeeze instead of spilling into new windows.",
		shotAlt: "Lyra in split view: several sessions side by side in one window.",
	},
	agents: {
		eyebrow: "Sub-agents",
		title: "Fan out. Report back.",
		lead: "The task tool hands work to agents with their own context. The legwork stays with them; only the conclusion comes back.",
		builtins: ["general", "explore", "review", "verify", "plan", "simple", "reason"],
		builtinsNote: "Seven built in. Write your own in .lyra/agents.",
		lanesTitle: "3 sub-agents running",
		lanes: [
			{ agent: "verify", done: "All tests pass" },
			{ agent: "verify", done: "Types check out" },
			{ agent: "review", done: "Found 2 issues" },
		],
		lanesDone: "Conclusions are back in the main chat",
		shotAlt: "Lyra’s sub-agent pane: what each sub-agent is doing.",
	},
	market: {
		eyebrow: "Plugin market",
		title: "Install it. Now it knows how.",
		lead: "Skills, plugins, and MCP servers, browsed in one place and installed in one click. Skills load only when used, so dozens cost almost no context.",
		countLabel: "skills, plugins, and MCP servers, and counting",
		link: "Browse the market",
		wallLabel: "Some of what is in the plugin market",
		shotAlt: "Lyra’s plugin market: skills, plugins, and MCP servers by category.",
		detailAlt: "One entry’s page in the plugin market.",
	},
	workspace: {
		eyebrow: "Workspace",
		title: "Right beside the chat.",
		steps: [
			{ title: "File preview", body: "Files open beside the chat: code highlighted, Markdown rendered, mermaid diagrams and all.", scene: "file-preview" as Scene, alt: "Lyra’s file preview: a code file open beside the chat." },
			{ title: "Nine panes", body: "Terminal, files, Git, browser, sub-agents and more. Open them all and drag them anywhere.", scene: "workspace-panels" as Scene, alt: "Lyra’s workspace panes: terminal, Git and more open at once." },
			{ title: "Scheduled tasks", body: "Audit dependencies at nine every morning? Set the time; a fresh session runs it for you.", scene: "schedule" as Scene, alt: "Lyra’s scheduled tasks: prompts that run daily or on an interval." },
		],
		notice: { app: "Lyra", body: "“Dependency audit” finished", time: "now" },
	},
	mobile: {
		eyebrow: "On your phone",
		title: "Start at your desk. Carry on from your phone.",
		lead: "Your phone replays the same session log: watch a turn, approve an action, ask a follow-up. Models and keys never leave your computer.",
		paths: [
			{ icon: "wifi", title: "Same Wi-Fi", body: "Direct, and fastest." },
			{ icon: "link", title: "Your own domain", body: "Through your domain and TLS." },
			{ icon: "relay", title: "Relay", body: "When neither side can reach the other." },
		],
		synced: "Synced with desktop",
		phoneAlt: "Lyra on a phone.",
		desktopAlt: "The same session on the desktop.",
		approvalAlt: "Lyra on a phone, waiting for approval to run a command: deny, don’t ask again, or allow once.",
		listAlt: "Projects and sessions on the phone; the one waiting for approval is marked.",
		readingAlt: "Reading, on the phone, a conversation finished on the desktop.",
	},
	open: {
		eyebrow: "MIT licensed",
		title: "Open source. On everything.",
		lead: "Every line is on GitHub. Each release ships for macOS, Windows, Linux, Android, and iOS.",
		github: "View on GitHub",
		downloads: "All downloads",
		platforms: "Supported platforms",
		fromSource: "Run from source",
	},
	bento: {
		title: "And there’s more.",
		permissions: { title: "Three permission modes", body: "Ask for approval, let it approve all but what looks risky, or give it full access. Switch any time from the composer.", modes: ["Ask for approval", "Auto approve", "Full access"] },
		context: { title: "Context at a glance", body: "A ring in the composer shows how much is used. Click it for the breakdown." },
		awake: { title: "Awake while it works", body: "One switch in General settings. Closing the lid still sleeps." },
		sidechat: { title: "Side chat", body: "A second conversation beside the first. It reads the main chat and writes nothing into it.", ask: "What did that error mean?", answer: "The config is missing a field…" },
		mcp: { title: "MCP", body: "All three transports. Tools carry their server’s name, so nothing collides." },
		browser: { title: "Built-in browser", body: "The agent drives the very page you are looking at.", url: "market.07230805.xyz", button: "Install" },
		skills: { title: "Skills on demand", body: "Only names and descriptions sit in the prompt; the body loads when it is used. Dozens cost almost nothing." },
		format: { title: "Built-in formatters", body: "Format in one click, or on save if you turn it on. Your project’s .prettierrc and .editorconfig come first." },
		notify: { title: "It tells you when it’s done", body: "A system notification when a task finishes while you are elsewhere." },
	},
	cta: {
		title: "Take Lyra home.",
		lead: "Free for macOS, Windows, Linux, Android, and iOS.",
		download: "Download Lyra",
		docs: "Read the docs",
		mascotAlt: "Lyra’s mascot: a blue-haired girl holding a white rabbit.",
	},
};

export const HOME_TEXT: Record<Locale, HomeText> = { "zh-CN": zh, en };
