/**
 * Four made-up open-source projects, small enough to write by hand and real enough to be opened.
 *
 * `aurora-notes` is the lead: a local-first Markdown notebook whose offline sync loses edits, which
 * is what the agent fixes in the hero shot. Its helpers for a proper merge already exist — a hybrid
 * logical clock and a block-level three-way merge — and `mergeNote` simply never used them; that is
 * why the fix is a clean, readable diff.
 *
 * Code and READMEs are in English in both languages, as they would be in a real open-source repo.
 * The design document the file-preview shot opens is written in the interface language.
 */

import type { Lang, ProjectSpec } from "./types.ts";

// ---------------------------------------------------------------------------
// aurora-notes
// ---------------------------------------------------------------------------

const AURORA_PACKAGE = `{
  "name": "aurora-notes",
  "version": "0.14.2",
  "private": true,
  "type": "module",
  "description": "A local-first Markdown notebook that syncs without a server you have to trust.",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "dependencies": {
    "dexie": "^4.0.11",
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.0.3",
    "typescript": "^5.9.2",
    "vite": "^7.1.6",
    "vitest": "^3.2.4"
  }
}
`;

const AURORA_README = `# Aurora Notes

A local-first Markdown notebook. Notes live on your device, sync between your devices through an
end-to-end encrypted relay, and keep working when you are offline.

## Features

- **Local-first** — every note is stored in IndexedDB; the network is optional.
- **Block-level sync** — concurrent edits merge paragraph by paragraph, ordered by a hybrid logical clock.
- **Live Markdown** — tables, task lists, math and diagrams render as you type.
- **End-to-end encrypted** — the relay only ever sees ciphertext.

## Getting started

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

## Project layout

| Path | What lives there |
| --- | --- |
| \`src/editor\` | The editor, its Markdown shortcuts and rendering |
| \`src/sync\` | Clocks, block merging and the offline outbox |
| \`src/store\` | IndexedDB persistence |
| \`test\` | Vitest suites |

## License

MIT
`;

const AURORA_TYPES = `/** A hybrid logical clock reading: wall time that never runs backwards, plus a tie-breaker. */
export interface Hlc {
  /** Milliseconds, never behind the last value this device has seen. */
  wall: number;
  /** Orders events that share the same millisecond. */
  counter: number;
  /** The device that produced the event. */
  node: string;
}

export interface Block {
  id: string;
  text: string;
  clock: Hlc;
}

export interface Note {
  id: string;
  title: string;
  blocks: Block[];
  clock: Hlc;
  updatedAt: number;
}
`;

const AURORA_HLC = `import type { Hlc } from "./types";

/** Total order over clock readings: wall time, then counter, then device id. */
export function compareHlc(a: Hlc, b: Hlc): number {
  if (a.wall !== b.wall) return a.wall - b.wall;
  if (a.counter !== b.counter) return a.counter - b.counter;
  return a.node < b.node ? -1 : a.node > b.node ? 1 : 0;
}

export function maxHlc(a: Hlc, b: Hlc): Hlc {
  return compareHlc(a, b) >= 0 ? a : b;
}

/** Advance the clock for a local event, or for a message received from another device. */
export function tick(last: Hlc, now: number, node: string, seen?: Hlc): Hlc {
  const wall = Math.max(last.wall, seen?.wall ?? 0, now);
  const counter =
    wall === last.wall && wall === seen?.wall
      ? Math.max(last.counter, seen.counter) + 1
      : wall === last.wall
        ? last.counter + 1
        : wall === seen?.wall
          ? seen.counter + 1
          : 0;
  return { wall, counter, node };
}
`;

const AURORA_BLOCKS = `import type { Block, Hlc } from "./types";

type Compare = (a: Hlc, b: Hlc) => number;

/**
 * Three-way merge of a note's blocks.
 *
 * A block changed on one side keeps that change. A block changed on both sides keeps the later
 * edit according to \`compare\`. Blocks added on either side are kept, in order.
 */
export function mergeBlocks(base: Block[], local: Block[], remote: Block[], compare: Compare): Block[] {
  const before = new Map(base.map((block) => [block.id, block]));
  const theirs = new Map(remote.map((block) => [block.id, block]));
  const merged: Block[] = [];

  for (const mine of local) {
    const other = theirs.get(mine.id);
    if (!other) {
      merged.push(mine);
      continue;
    }
    theirs.delete(mine.id);
    const original = before.get(mine.id);
    const mineChanged = mine.text !== original?.text;
    const otherChanged = other.text !== original?.text;
    if (mineChanged && otherChanged) merged.push(compare(mine.clock, other.clock) >= 0 ? mine : other);
    else merged.push(otherChanged ? other : mine);
  }

  return [...merged, ...theirs.values()];
}
`;

/**
 * Before the fix: last writer wins, by each device's own wall clock. The block merge and the clock
 * are already imported — a refactor someone started and never finished — so the fix is one hunk.
 */
export const AURORA_MERGE = `import { mergeBlocks } from "./blocks";
import { compareHlc, maxHlc } from "./hlc";
import type { Note } from "./types";

/**
 * Reconcile a note that was edited on two devices while they were offline.
 *
 * \`base\` is the last version both devices agreed on; \`local\` and \`remote\`
 * are what each of them has now.
 */
export function mergeNote(base: Note, local: Note, remote: Note): Note {
  if (local.id !== remote.id) {
    throw new Error(\`mergeNote: \${local.id} and \${remote.id} are different notes\`);
  }

  // Last writer wins.
  if (remote.updatedAt > local.updatedAt) return remote;
  return local;
}
`;

const AURORA_QUEUE = `import { db } from "../store/db";
import { mergeNote } from "./merge";
import type { Note } from "./types";

export interface Transport {
  pull(since: number): Promise<Note[]>;
  push(notes: Note[]): Promise<void>;
}

/** Send what changed offline, take what changed elsewhere, merge where both sides touched a note. */
export async function flush(transport: Transport, since: number): Promise<number> {
  const outbox = await db.outbox.toArray();
  const remote = await transport.pull(since);
  const merged: Note[] = [];

  for (const theirs of remote) {
    const [mine, base] = await Promise.all([db.notes.get(theirs.id), db.bases.get(theirs.id)]);
    merged.push(mine && base ? mergeNote(base, mine, theirs) : theirs);
  }

  await db.transaction("rw", db.notes, db.bases, db.outbox, async () => {
    await db.notes.bulkPut(merged);
    await db.bases.bulkPut(merged);
    await db.outbox.clear();
  });

  const pending = await db.notes.bulkGet(outbox.map((entry) => entry.noteId));
  await transport.push(pending.filter((note): note is Note => Boolean(note)));
  return merged.length;
}
`;

const AURORA_DB = `import Dexie, { type Table } from "dexie";
import type { Note } from "../sync/types";

export interface OutboxEntry {
  id?: number;
  noteId: string;
  at: number;
}

export class NotesDb extends Dexie {
  notes!: Table<Note, string>;
  /** The last version every device agreed on — the \`base\` of a three-way merge. */
  bases!: Table<Note, string>;
  outbox!: Table<OutboxEntry, number>;

  constructor() {
    super("aurora");
    this.version(4).stores({
      notes: "id, updatedAt",
      bases: "id",
      outbox: "++id, noteId, at",
    });
  }
}

export const db = new NotesDb();
`;

const AURORA_EDITOR = `import { useCallback, useRef } from "react";
import { applyShortcut } from "./shortcuts";
import { Preview } from "./Preview";

export function Editor({ value, onChange }: { value: string; onChange(next: string): void }) {
  const area = useRef<HTMLTextAreaElement>(null);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const field = area.current;
      if (!field) return;
      const next = applyShortcut(event, field.value, field.selectionStart, field.selectionEnd);
      if (next) {
        event.preventDefault();
        onChange(next.text);
        requestAnimationFrame(() => field.setSelectionRange(next.cursor, next.cursor));
      }
    },
    [onChange],
  );

  return (
    <div className="editor">
      <textarea ref={area} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />
      <Preview source={value} />
    </div>
  );
}
`;

export const AURORA_SHORTCUTS = `export interface Edit {
  text: string;
  cursor: number;
}

/** Markdown conveniences: continue lists, indent with Tab, wrap selections in marks. */
export function applyShortcut(
  event: { key: string; shiftKey: boolean; metaKey: boolean },
  text: string,
  start: number,
  end: number,
): Edit | null {
  if (event.key === "Enter") return continueList(text, start);
  if (event.key === "Tab") return indent(text, start, end, event.shiftKey ? -1 : 1);
  if (event.metaKey && event.key === "b") return wrap(text, start, end, "**");
  if (event.metaKey && event.key === "i") return wrap(text, start, end, "_");
  return null;
}

function continueList(text: string, at: number): Edit | null {
  const lineStart = text.lastIndexOf("\\n", at - 1) + 1;
  const line = text.slice(lineStart, at);
  const bullet = /^(\\s*)([-*]|\\d+\\.)\\s(\\[[ x]\\]\\s)?/.exec(line);
  if (!bullet) return null;
  const marker = /\\d+/.test(bullet[2]) ? \`\${Number.parseInt(bullet[2], 10) + 1}.\` : bullet[2];
  const insert = \`\\n\${bullet[1]}\${marker} \${bullet[3] ? "[ ] " : ""}\`;
  return { text: text.slice(0, at) + insert + text.slice(at), cursor: at + insert.length };
}

function indent(text: string, start: number, end: number, direction: 1 | -1): Edit {
  const lineStart = text.lastIndexOf("\\n", start - 1) + 1;
  const block = text.slice(lineStart, end);
  const shifted = block
    .split("\\n")
    .map((line) => (direction > 0 ? \`  \${line}\` : line.replace(/^ {1,2}/, "")))
    .join("\\n");
  return { text: text.slice(0, lineStart) + shifted + text.slice(end), cursor: start + direction * 2 };
}

function wrap(text: string, start: number, end: number, mark: string): Edit {
  const inner = text.slice(start, end);
  return { text: text.slice(0, start) + mark + inner + mark + text.slice(end), cursor: end + mark.length * 2 };
}
`;

const AURORA_PREVIEW = `import { useMemo } from "react";
import { parse, toReact } from "./markdown";

/** Live preview: the Markdown is parsed to a tree and rendered as React elements, never as raw HTML. */
export function Preview({ source }: { source: string }) {
  const tree = useMemo(() => parse(source), [source]);
  return <article className="preview">{toReact(tree)}</article>;
}
`;

const AURORA_FIXTURES = `import type { Block, Hlc, Note } from "../../src/sync/types";

export const at = (wall: number, node: string, counter = 0): Hlc => ({ wall, counter, node });

/** A note whose blocks are the given lines, all stamped with \`clock\`. */
export function note(lines: string[], clock: Hlc = at(0, "base")): Note {
  const blocks: Block[] = lines.map((text, index) => ({ id: \`b\${index}\`, text, clock }));
  return { id: "n1", title: lines[0] ?? "", blocks, clock, updatedAt: clock.wall };
}
`;

const AURORA_HLC_TEST = `import { describe, expect, it } from "vitest";
import { compareHlc, maxHlc, tick } from "../../src/sync/hlc";
import { at } from "../fixtures/notes";

describe("hybrid logical clock", () => {
  it("orders by wall time first", () => {
    expect(compareHlc(at(2, "a"), at(1, "b"))).toBeGreaterThan(0);
  });

  it("breaks ties with the counter, then the device", () => {
    expect(compareHlc(at(1, "a", 2), at(1, "a", 1))).toBeGreaterThan(0);
    expect(compareHlc(at(1, "b"), at(1, "a"))).toBeGreaterThan(0);
  });

  it("never runs backwards when the wall clock does", () => {
    const next = tick(at(5_000, "laptop"), 4_000, "laptop");
    expect(next.wall).toBe(5_000);
    expect(next.counter).toBe(1);
  });

  it("moves past a clock it has seen from another device", () => {
    const next = tick(at(1_000, "laptop"), 1_000, "laptop", at(9_000, "phone", 3));
    expect(next).toEqual({ wall: 9_000, counter: 4, node: "laptop" });
  });

  it("picks the later reading", () => {
    expect(maxHlc(at(1, "a"), at(3, "b")).wall).toBe(3);
  });
});
`;

const AURORA_BLOCKS_TEST = `import { describe, expect, it } from "vitest";
import { mergeBlocks } from "../../src/sync/blocks";
import { compareHlc } from "../../src/sync/hlc";
import { at, note } from "../fixtures/notes";

const texts = (blocks: { text: string }[]) => blocks.map((block) => block.text);

describe("mergeBlocks", () => {
  it("keeps a change made on one side", () => {
    const base = note(["a", "b"]);
    const mine = note(["a", "B"], at(1, "laptop"));
    expect(texts(mergeBlocks(base.blocks, mine.blocks, base.blocks, compareHlc))).toEqual(["a", "B"]);
  });

  it("keeps the later edit when both sides changed a block", () => {
    const base = note(["a"]);
    const mine = note(["mine"], at(2, "laptop"));
    const theirs = note(["theirs"], at(3, "phone"));
    expect(texts(mergeBlocks(base.blocks, mine.blocks, theirs.blocks, compareHlc))).toEqual(["theirs"]);
  });
});
`;

const AURORA_CHANGELOG = `# Changelog

## 0.14.2 — 2026-09-19

- Offline outbox: edits made without a connection are queued and sent on reconnect.
- Fixed the editor losing the cursor after continuing a numbered list.

## 0.14.0 — 2026-09-03

- Block-level merge helpers and a hybrid logical clock (not wired into sync yet).
- Tables render in the live preview.

## 0.13.0 — 2026-08-11

- Notes are stored in IndexedDB through Dexie; the old localStorage store is migrated on first launch.
`;

const SYNC_DESIGN: Record<Lang, string> = {
	zh: `# 同步设计

Aurora 是本地优先的：笔记先写进本机的 IndexedDB，网络只负责在设备之间交换改动。这份文档说明两台设备**离线期间都改了同一篇笔记**时，同步回来会发生什么。

## 合并流程

\`\`\`mermaid
sequenceDiagram
    participant L as 笔记本
    participant R as 中继
    participant P as 手机
    L->>R: 推送离线期间的改动
    P->>R: 推送离线期间的改动
    R-->>L: 拉取手机的版本
    Note over L: 以共同祖先为 base<br/>逐块三方合并
    L->>R: 推送合并结果
    R-->>P: 下发合并结果
\`\`\`

三方合并逐块进行：

1. 只有一边改了的块，采用改了的那一边
2. 两边都改了的块，按 HLC 取较晚的一边
3. 任意一边新增的块，按原顺序保留

## 数据模型

一篇笔记由若干**块**组成，每块大致对应一个段落，各自带一个混合逻辑时钟（HLC）读数：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| \`wall\` | \`number\` | 毫秒时间，永不回退 |
| \`counter\` | \`number\` | 同一毫秒内的先后 |
| \`node\` | \`string\` | 产生这次改动的设备 |

\`\`\`ts
const blocks = mergeBlocks(base.blocks, local.blocks, remote.blocks, compareHlc);
return { ...local, blocks, clock: maxHlc(local.clock, remote.clock) };
\`\`\`

## 目标

- 离线时照常编辑，重新联网后自动合并，不弹冲突对话框
- 两边改的是**不同段落**时，两边的改动都保留
- 两边改了**同一段**时，结果对所有设备一致，且不依赖设备时钟是否准确

> 设备时钟不可信：手机和笔记本相差几分钟很常见，只按墙上时间比较，较新的修改会被判成旧的。

## 未解决的问题

- [x] 块级三方合并
- [x] 混合逻辑时钟
- [ ] 同一段落内的字符级合并（考虑引入 CRDT 文本类型）
- [ ] 删除与修改同时发生时的提示
`,
	en: `# Sync design

Aurora is local-first: a note is written to IndexedDB on the device first, and the network only carries changes between devices. This document covers what happens when **two devices both edit the same note while offline**.

## Merging

\`\`\`mermaid
sequenceDiagram
    participant L as Laptop
    participant R as Relay
    participant P as Phone
    L->>R: Push offline changes
    P->>R: Push offline changes
    R-->>L: Pull the phone's version
    Note over L: Three-way merge<br/>against the common base
    L->>R: Push the merged note
    R-->>P: Deliver the merged note
\`\`\`

The three-way merge runs block by block:

1. A block changed on one side takes that side
2. A block changed on both sides takes the later edit by HLC
3. Blocks added on either side are kept, in order

## Data model

A note is a list of **blocks**, roughly one per paragraph, each stamped with a hybrid logical clock (HLC) reading:

| Field | Type | Meaning |
| --- | --- | --- |
| \`wall\` | \`number\` | Milliseconds, never runs backwards |
| \`counter\` | \`number\` | Order within the same millisecond |
| \`node\` | \`string\` | The device that made the change |

\`\`\`ts
const blocks = mergeBlocks(base.blocks, local.blocks, remote.blocks, compareHlc);
return { ...local, blocks, clock: maxHlc(local.clock, remote.clock) };
\`\`\`

## Goals

- Keep editing offline, merge automatically on reconnect, never show a conflict dialog
- When the two sides changed **different paragraphs**, keep both changes
- When they changed **the same paragraph**, every device reaches the same result — without trusting any device's clock

> Device clocks cannot be trusted: a phone and a laptop minutes apart is normal, and comparing wall time alone makes the newer edit look older.

## Open questions

- [x] Block-level three-way merge
- [x] Hybrid logical clock
- [ ] Character-level merge within a paragraph (a CRDT text type?)
- [ ] Surfacing a delete that raced an edit
`,
};

function aurora(lang: Lang): ProjectSpec {
	return {
		name: "aurora-notes",
		owner: "mayachen",
		branch: "fix/offline-merge",
		history: [
			{
				message: "Scaffold Vite + React app",
				when: "2026-06-02T10:14:00+08:00",
				files: {
					"package.json": AURORA_PACKAGE,
					"README.md": AURORA_README,
					".gitignore": "node_modules\ndist\n.DS_Store\n",
					"tsconfig.json": `{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "ESNext",\n    "moduleResolution": "Bundler",\n    "jsx": "react-jsx",\n    "strict": true,\n    "skipLibCheck": true\n  },\n  "include": ["src", "test"]\n}\n`,
					"vite.config.ts": `import react from "@vitejs/plugin-react";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({\n  plugins: [react()],\n  test: { environment: "node" },\n});\n`,
					"src/main.tsx": `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport { App } from "./app/App";\nimport "./styles.css";\n\ncreateRoot(document.getElementById("root")!).render(\n  <StrictMode>\n    <App />\n  </StrictMode>,\n);\n`,
					"src/app/App.tsx": `import { useState } from "react";\nimport { Editor } from "../editor/Editor";\n\nexport function App() {\n  const [text, setText] = useState("# Welcome to Aurora\\n\\nStart typing.");\n  return <Editor value={text} onChange={setText} />;\n}\n`,
					"src/editor/Editor.tsx": AURORA_EDITOR,
					"src/editor/shortcuts.ts": AURORA_SHORTCUTS,
					"src/editor/Preview.tsx": AURORA_PREVIEW,
					"src/styles.css": `:root {\n  color-scheme: light dark;\n  font-family: "Inter", system-ui, sans-serif;\n}\n\n.editor {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  height: 100vh;\n}\n`,
				},
			},
			{
				message: "Store notes in IndexedDB via Dexie",
				when: "2026-08-11T16:42:00+08:00",
				files: { "src/store/db.ts": AURORA_DB, "src/sync/types.ts": AURORA_TYPES },
			},
			{
				message: "Add hybrid logical clock and block-level merge helpers",
				when: "2026-09-03T11:05:00+08:00",
				files: {
					"src/sync/hlc.ts": AURORA_HLC,
					"src/sync/blocks.ts": AURORA_BLOCKS,
					"src/sync/merge.ts": AURORA_MERGE,
					"test/fixtures/notes.ts": AURORA_FIXTURES,
					"test/sync/hlc.test.ts": AURORA_HLC_TEST,
					"test/sync/blocks.test.ts": AURORA_BLOCKS_TEST,
				},
			},
			{
				message: "Offline outbox: queue edits and flush on reconnect",
				when: "2026-09-19T20:31:00+08:00",
				files: { "src/sync/queue.ts": AURORA_QUEUE, "CHANGELOG.md": AURORA_CHANGELOG },
			},
			{
				message: lang === "zh" ? "docs: 同步设计" : "docs: sync design",
				when: "2026-09-24T09:12:00+08:00",
				files: { "docs/sync-design.md": SYNC_DESIGN[lang] },
			},
		],
		vitest: [
			{ file: "test/editor/shortcuts.test.ts", tests: 9, ms: 6 },
			{ file: "test/sync/hlc.test.ts", tests: 5, ms: 3 },
			{ file: "test/sync/blocks.test.ts", tests: 2, ms: 2 },
			{ file: "test/sync/merge.test.ts", tests: 3, ms: 4 },
		],
	};
}

// ---------------------------------------------------------------------------
// atlas-api — a Go service
// ---------------------------------------------------------------------------

const ATLAS_BUCKET = `package ratelimit

import (
	"sync"
	"time"
)

// Bucket is a token bucket: it holds up to Burst tokens and refills at Rate per second.
type Bucket struct {
	mu     sync.Mutex
	Rate   float64
	Burst  float64
	tokens float64
	last   time.Time
}

func New(rate, burst float64) *Bucket {
	return &Bucket{Rate: rate, Burst: burst, tokens: burst, last: time.Now()}
}

// Allow takes one token if there is one.
func (b *Bucket) Allow(now time.Time) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	elapsed := now.Sub(b.last).Seconds()
	b.tokens = min(b.Burst, b.tokens+elapsed*b.Rate)
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}
`;

const ATLAS_HANDLER = `package search

import (
	"encoding/json"
	"net/http"
	"strconv"
)

type Handler struct {
	Index Index
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	hits, err := h.Index.Search(r.Context(), q, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"query": q, "hits": hits})
}
`;

function atlas(): ProjectSpec {
	return {
		name: "atlas-api",
		owner: "atlas-labs",
		branch: "feat/search-rate-limit",
		history: [
			{
				message: "Initial service skeleton",
				when: "2026-07-08T14:20:00+08:00",
				files: {
					"go.mod": "module github.com/atlas-labs/atlas-api\n\ngo 1.25\n",
					"README.md": "# atlas-api\n\nThe HTTP API behind Atlas search.\n\n```bash\ngo run ./cmd/atlas\n```\n",
					"cmd/atlas/main.go": `package main\n\nimport (\n\t"log"\n\t"net/http"\n\n\t"github.com/atlas-labs/atlas-api/internal/search"\n)\n\nfunc main() {\n\tmux := http.NewServeMux()\n\tmux.Handle("GET /v2/search", &search.Handler{Index: search.NewIndex()})\n\tlog.Fatal(http.ListenAndServe(":8080", mux))\n}\n`,
					"internal/search/handler.go": ATLAS_HANDLER,
					"internal/search/index.go": `package search\n\nimport "context"\n\ntype Hit struct {\n\tID    string  \`json:"id"\`\n\tTitle string  \`json:"title"\`\n\tScore float64 \`json:"score"\`\n}\n\ntype Index interface {\n\tSearch(ctx context.Context, q string, limit int) ([]Hit, error)\n}\n\nfunc NewIndex() Index { return &memoryIndex{} }\n\ntype memoryIndex struct{}\n\nfunc (m *memoryIndex) Search(ctx context.Context, q string, limit int) ([]Hit, error) {\n\treturn nil, nil\n}\n`,
				},
			},
			{
				message: "ratelimit: token bucket",
				when: "2026-09-22T17:48:00+08:00",
				files: { "internal/ratelimit/bucket.go": ATLAS_BUCKET },
			},
		],
	};
}

// ---------------------------------------------------------------------------
// lumen-ui — a component library
// ---------------------------------------------------------------------------

function lumen(): ProjectSpec {
	return {
		name: "lumen-ui",
		owner: "lumen-design",
		branch: "main",
		history: [
			{
				message: "Button, Tooltip and design tokens",
				when: "2026-08-28T15:02:00+08:00",
				files: {
					"package.json": `{\n  "name": "@lumen/ui",\n  "version": "2.3.0",\n  "type": "module",\n  "scripts": { "storybook": "storybook dev -p 6006", "test": "vitest run" }\n}\n`,
					"README.md": "# Lumen UI\n\nAccessible React components with design tokens that work in light and dark.\n",
					"src/tokens.css": `:root {\n  --lumen-accent: #4f7cff;\n  --lumen-radius: 10px;\n  --lumen-ink: #1b1d22;\n  --lumen-surface: #ffffff;\n}\n\n:root.dark {\n  --lumen-ink: #eceef2;\n  --lumen-surface: #16181d;\n}\n`,
					"src/button/Button.tsx": `import type { ButtonHTMLAttributes } from "react";\nimport "./button.css";\n\nexport interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {\n  variant?: "solid" | "soft" | "ghost";\n}\n\nexport function Button({ variant = "solid", className, ...props }: ButtonProps) {\n  return <button className={\`lumen-button lumen-button--\${variant} \${className ?? ""}\`} {...props} />;\n}\n`,
					"src/button/button.css": `.lumen-button {\n  border-radius: var(--lumen-radius);\n  padding: 6px 14px;\n  font: inherit;\n}\n\n.lumen-button--soft {\n  background: color-mix(in oklab, var(--lumen-accent) 14%, transparent);\n  color: var(--lumen-accent);\n}\n`,
					"src/tooltip/Tooltip.tsx": `import { useId, useState, type ReactNode } from "react";\n\nexport function Tooltip({ label, children }: { label: string; children: ReactNode }) {\n  const [open, setOpen] = useState(false);\n  const id = useId();\n  return (\n    <span onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} aria-describedby={id}>\n      {children}\n      {open && <span role="tooltip" id={id}>{label}</span>}\n    </span>\n  );\n}\n`,
				},
			},
		],
	};
}

// ---------------------------------------------------------------------------
// orbit-cli — a Rust command-line tool
// ---------------------------------------------------------------------------

function orbit(): ProjectSpec {
	return {
		name: "orbit-cli",
		owner: "mayachen",
		branch: "release/0.8",
		history: [
			{
				message: "orbit: deploy previews from the terminal",
				when: "2026-07-30T21:10:00+08:00",
				files: {
					"Cargo.toml": `[package]\nname = "orbit-cli"\nversion = "0.8.0"\nedition = "2024"\n\n[dependencies]\nclap = { version = "4.5", features = ["derive"] }\nserde = { version = "1", features = ["derive"] }\nserde_json = "1"\n`,
					"README.md": "# orbit\n\nDeploy preview environments from your terminal.\n\n```bash\norbit up --branch feat/login\n```\n",
					"src/main.rs": `use clap::Parser;\n\n#[derive(Parser)]\n#[command(name = "orbit", version)]\nstruct Cli {\n    /// Branch to deploy\n    #[arg(long)]\n    branch: String,\n    /// Print machine-readable output\n    #[arg(long)]\n    json: bool,\n}\n\nfn main() {\n    let cli = Cli::parse();\n    println!("Deploying {}", cli.branch);\n}\n`,
					"CHANGELOG.md": "# Changelog\n\n## Unreleased\n\n- `--json` output for `orbit up` and `orbit ls`\n- Faster preview teardown\n",
				},
			},
		],
	};
}

export function projectsFor(lang: Lang): ProjectSpec[] {
	return [aurora(lang), atlas(), lumen(), orbit()];
}
