/**
 * A finished conversation in `atlas-api`: per-key rate limiting on the search endpoint.
 *
 * It runs for real before the shot — two reads, a new file, an edit — so the transcript carries the
 * collapsed record of that work and the card listing the files it changed, the way a conversation
 * someone came back to looks.
 */

import type { Script } from "../lib/model.ts";
import type { Lang } from "./types.ts";

export const ATLAS_MAIN_BEFORE = `import (
	"log"
	"net/http"

	"github.com/atlas-labs/atlas-api/internal/search"
)

func main() {
	mux := http.NewServeMux()
	mux.Handle("GET /v2/search", &search.Handler{Index: search.NewIndex()})`;

const ATLAS_MAIN_AFTER = `import (
	"log"
	"net/http"

	"github.com/atlas-labs/atlas-api/internal/ratelimit"
	"github.com/atlas-labs/atlas-api/internal/search"
)

func main() {
	mux := http.NewServeMux()
	apiKey := func(r *http.Request) string { return r.Header.Get("X-API-Key") }
	limit := ratelimit.PerKey(10, 20, apiKey)
	mux.Handle("GET /v2/search", limit(&search.Handler{Index: search.NewIndex()}))`;

const PER_KEY = `package ratelimit

import (
	"net/http"
	"sync"
	"time"
)

// PerKey limits each API key to rate requests a second, with bursts of up to burst.
// Over the limit, the request is answered 429 with a Retry-After header.
func PerKey(rate, burst float64, key func(*http.Request) string) func(http.Handler) http.Handler {
	var buckets sync.Map
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			b, _ := buckets.LoadOrStore(key(r), New(rate, burst))
			if !b.(*Bucket).Allow(time.Now()) {
				w.Header().Set("Retry-After", "1")
				http.Error(w, "rate limited", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
`;

const words = {
	zh: {
		ask: "给 /v2/search 按 API key 加限流：每秒 10 个请求，允许突发 20 个。",
		title: "给 /v2/search 加令牌桶限流",
		done: [
			"## 已接好",
			"",
			"`/v2/search` 现在按 API key 限流：每个 key 一个令牌桶，超限返回 **429** 并带上 `Retry-After`。",
			"",
			"| 参数 | 值 |",
			"| --- | --- |",
			"| 速率 | 每秒 10 个请求 |",
			"| 突发 | 20 个 |",
			"| 超限 | `429 Too Many Requests` |",
			"",
			"```go",
			"limit := ratelimit.PerKey(10, 20, apiKey)",
			"mux.Handle(\"GET /v2/search\", limit(search))",
			"```",
			"",
			"令牌桶放在 `sync.Map` 里，同一个 key 的并发请求共用一个桶。",
		].join("\n"),
	},
	en: {
		ask: "Rate-limit /v2/search per API key: 10 requests a second, bursts of 20.",
		title: "Rate-limit /v2/search",
		done: [
			"## Wired up",
			"",
			"`/v2/search` is now limited per API key: one token bucket per key, and over the limit it answers **429** with `Retry-After`.",
			"",
			"| Setting | Value |",
			"| --- | --- |",
			"| Rate | 10 requests a second |",
			"| Burst | 20 |",
			"| Over the limit | `429 Too Many Requests` |",
			"",
			"```go",
			"limit := ratelimit.PerKey(10, 20, apiKey)",
			"mux.Handle(\"GET /v2/search\", limit(search))",
			"```",
			"",
			"The buckets live in a `sync.Map`, so concurrent requests for one key share a bucket.",
		].join("\n"),
	},
} as const;

export function atlasAsk(lang: Lang): string {
	return words[lang].ask;
}

export function atlasScript(lang: Lang): Script {
	const w = words[lang];
	return {
		cue: w.ask.slice(0, 14),
		title: w.title,
		steps: [
			{
				delay: 300,
				tools: [
					{ name: "read", input: { path: "internal/search/handler.go" } },
					{ name: "read", input: { path: "internal/ratelimit/bucket.go" } },
					{ name: "read", input: { path: "cmd/atlas/main.go" } },
				],
			},
			{
				delay: 300,
				tools: [
					{ name: "write", input: { path: "internal/ratelimit/perkey.go", content: PER_KEY } },
					{ name: "edit", input: { path: "cmd/atlas/main.go", old_string: ATLAS_MAIN_BEFORE, new_string: ATLAS_MAIN_AFTER } },
				],
			},
			{ text: w.done, delay: 300, rate: 45 },
		],
	};
}
