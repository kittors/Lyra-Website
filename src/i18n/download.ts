import type { Os } from "../../shared/release.ts";
import type { Locale } from "./index.ts";

/**
 * The download page's words. The first-launch guides follow Lyra's README word for word in
 * substance — they are what a reader needs when the system blocks the app, and a guide that
 * disagrees with the README is a guide that is wrong.
 */

interface Step {
	text: string;
	/** A command to copy, shown under the step. `{file}` is the installer's file name. */
	code?: string;
}

interface Guide {
	os: Os | "phone";
	title: string;
	intro?: string;
	steps: Step[];
	note?: string;
}

const zh = {
	title: "下载 Lyra",
	lead: "免费，开源。桌面与手机，全平台。",
	chooseTitle: "选择你的平台",
	chooseBody: "下面列出了每个平台的安装包。",
	chooseAction: "查看全部平台",
	version: (version: string) => `版本 ${version}`,
	released: (date: string) => `发布于 ${date}`,
	altMac: { "mac-x64": "Mac 用的是 Intel 芯片？", "mac-arm64": "Mac 用的是 Apple 芯片？" },
	altWin: { "win-arm64": "骁龙等 ARM 电脑？", "win-x64": "x64 电脑？" },
	altLinuxDeb: "Debian 或 Ubuntu？",
	altLinuxAppImage: "想要免安装的 AppImage？",
	altAction: {
		"mac-x64": "下载 Intel 版",
		"mac-arm64": "下载 Apple 芯片版",
		"win-arm64": "下载 ARM 版",
		"win-x64": "下载 x64 版",
		"linux-x64-deb": "下载 .deb",
		"linux-arm64-deb": "下载 .deb",
		"linux-x64-appimage": "下载 AppImage",
		"linux-arm64-appimage": "下载 AppImage",
	} as Record<string, string>,
	iosNote: "需要用 Sideloadly、AltStore 或 Xcode 自己签名后安装。",
	androidNote: "第一次安装时，允许安装未知来源的应用。",
	source: { label: "下载来源：", github: "GitHub", mirror: "高速镜像", useGithub: "改用 GitHub", useMirror: "改用高速镜像" },
	releases: "历史版本",
	notes: "更新日志",
	checksums: "SHA256SUMS",
	allTitle: "所有平台",
	allLead: "每个版本都带齐全部系统与架构。",
	archHint: "不知道自己的架构？macOS 看「关于本机」的芯片一行；Windows 看「设置 → 系统 → 系统信息」的系统类型；Linux 运行 uname -m。",
	osNotes: {
		macos: "Apple 芯片与 Intel 芯片各一个安装包。",
		windows: "按处理器选择，x64 适用于大多数电脑。",
		linux: "AppImage 免安装、任何发行版可用；.deb 适用于 Debian 与 Ubuntu。",
		android: "所有 Android 手机通用。",
		ios: "未签名，需要自行签名后安装。",
	} as Record<Os, string>,
	download: "下载",
	recommended: "推荐",
	sha: "SHA-256",
	copy: "复制",
	copied: "已复制",
	guidesTitle: "第一次打开",
	guidesLead: "安装包没有付费证书，系统第一次会拦一下。按系统放行：",
	guides: [
		{
			os: "macos",
			title: "macOS",
			intro: "双击时 Gatekeeper 会提示「无法验证开发者」。两种方式任选其一：",
			steps: [
				{ text: "打开「系统设置 → 隐私与安全性」，点「仍要打开」，再输入密码确认。" },
				{ text: "或者在终端里去掉隔离标记：", code: "xattr -dr com.apple.quarantine /Applications/Lyra.app" },
			],
			note: "如果提示的是「已损坏」，那是 0.6.0 及更早的版本，换用最新版即可。",
		},
		{
			os: "windows",
			title: "Windows",
			intro: "第一次运行会出现 SmartScreen 的「Windows 已保护你的电脑」。",
			steps: [
				{ text: "点「更多信息」，再点「仍要运行」。" },
				{ text: "如果装完提示找不到 Lyra.exe，多半是被安全中心隔离了：到「Windows 安全中心 → 病毒和威胁防护 → 保护历史记录」里允许它，再运行一次安装包。" },
			],
		},
		{
			os: "linux",
			title: "Linux",
			intro: "AppImage 和 .deb 二选一。",
			steps: [
				{ text: "AppImage 不用安装，加上执行权限直接运行：", code: "chmod +x {appimage} && ./{appimage}" },
				{ text: ".deb 用 apt 安装：", code: "sudo apt install ./{deb}" },
			],
		},
		{
			os: "phone",
			title: "手机",
			intro: "手机端连接的是你电脑上的 Lyra，会话、模型和密钥都留在电脑上。",
			steps: [
				{ text: "Android：直接安装 APK，第一次会询问是否允许安装未知来源的应用。" },
				{ text: "iOS：IPA 未签名，用 Sideloadly、AltStore 或 Xcode 签名后安装，免费 Apple ID 就够。" },
				{ text: "装好后，在桌面端「设置 → 移动端同步」开启服务，扫码配对。" },
			],
		},
	] as Guide[],
	nextTitle: "装好之后",
	nextBody: "Lyra 不自带模型。先到「设置 → 模型设置」添加一个供应商：填 Base URL、选 API 格式、填 API Key，再添加至少一个模型。",
	nextLink: "阅读入门指南",
};

type DownloadText = typeof zh;

const en: DownloadText = {
	title: "Download Lyra",
	lead: "Free and open source, for desktop and phone.",
	chooseTitle: "Choose your platform",
	chooseBody: "Every platform’s installer is listed below.",
	chooseAction: "See all platforms",
	version: (version: string) => `Version ${version}`,
	released: (date: string) => `Released ${date}`,
	altMac: { "mac-x64": "Mac with an Intel chip?", "mac-arm64": "Mac with Apple silicon?" },
	altWin: { "win-arm64": "On a Snapdragon or other Arm PC?", "win-x64": "On an x64 PC?" },
	altLinuxDeb: "On Debian or Ubuntu?",
	altLinuxAppImage: "Prefer an AppImage?",
	altAction: {
		"mac-x64": "Download for Intel",
		"mac-arm64": "Download for Apple silicon",
		"win-arm64": "Download for Arm",
		"win-x64": "Download for x64",
		"linux-x64-deb": "Get the .deb",
		"linux-arm64-deb": "Get the .deb",
		"linux-x64-appimage": "Get the AppImage",
		"linux-arm64-appimage": "Get the AppImage",
	},
	iosNote: "Sign it yourself with Sideloadly, AltStore, or Xcode, then install.",
	androidNote: "The first time, allow installs from unknown sources.",
	source: { label: "Downloading from ", github: "GitHub", mirror: "High-speed mirror", useGithub: "Use GitHub", useMirror: "Use the mirror" },
	releases: "Previous releases",
	notes: "Release notes",
	checksums: "SHA256SUMS",
	allTitle: "All platforms",
	allLead: "Every release ships for every system and architecture.",
	archHint: "Not sure of your architecture? On a Mac, see the Chip line in About This Mac; on Windows, System type under Settings → System → About; on Linux, run uname -m.",
	osNotes: {
		macos: "One installer for Apple silicon, one for Intel.",
		windows: "Pick by processor. x64 fits most PCs.",
		linux: "The AppImage runs on any distribution; the .deb is for Debian and Ubuntu.",
		android: "One APK for every Android phone.",
		ios: "Unsigned. Sign it yourself before installing.",
	},
	download: "Download",
	recommended: "Recommended",
	sha: "SHA-256",
	copy: "Copy",
	copied: "Copied",
	guidesTitle: "First launch",
	guidesLead: "The installers aren’t signed with a paid certificate, so each system asks once. Here is the way through:",
	guides: [
		{
			os: "macos",
			title: "macOS",
			intro: "Gatekeeper says the developer cannot be verified. Either of these lets it through:",
			steps: [
				{ text: "Open System Settings → Privacy & Security, click Open Anyway, and confirm with your password." },
				{ text: "Or drop the quarantine flag in Terminal:", code: "xattr -dr com.apple.quarantine /Applications/Lyra.app" },
			],
			note: "If it says the app is damaged, that is a 0.6.0 or earlier build. Install the latest one.",
		},
		{
			os: "windows",
			title: "Windows",
			intro: "The first run shows SmartScreen: “Windows protected your PC.”",
			steps: [
				{ text: "Click More info, then Run anyway." },
				{ text: "If Windows then cannot find Lyra.exe, Defender has quarantined it: allow it under Windows Security → Virus & threat protection → Protection history, and run the installer again." },
			],
		},
		{
			os: "linux",
			title: "Linux",
			intro: "AppImage or .deb, not both.",
			steps: [
				{ text: "The AppImage needs no installing. Make it executable and run it:", code: "chmod +x {appimage} && ./{appimage}" },
				{ text: "Install the .deb with apt:", code: "sudo apt install ./{deb}" },
			],
		},
		{
			os: "phone",
			title: "Phone",
			intro: "The phone app talks to Lyra on your computer. Sessions, models, and keys stay on the computer.",
			steps: [
				{ text: "Android: install the APK. The first time, the phone asks to allow unknown sources." },
				{ text: "iOS: the IPA is unsigned. Sign it with Sideloadly, AltStore, or Xcode, then install. A free Apple ID is enough." },
				{ text: "Then, on the desktop, turn on Settings → Mobile sync and scan the pairing code." },
			],
		},
	],
	nextTitle: "After installing",
	nextBody: "Lyra doesn’t ship a model. Open Settings → Models, add a provider (Base URL, API format, API key), then add at least one model.",
	nextLink: "Read the getting-started guide",
};

export const DOWNLOAD_TEXT: Record<Locale, DownloadText> = { "zh-CN": zh, en };
