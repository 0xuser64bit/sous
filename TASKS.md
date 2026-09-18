# TASKS — agentic build order (do in order, one at a time)

## 00 Setup ✅
- [x] Next.js + TS + Tailwind + Solana deps + Nightly-first providers
- [x] Chain config, MCP proxy, TxStatus, chat shell, docs
- [x] Verify: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` + `pnpm dev` + connect Nightly on localhost

## 01 Harden signing path ✅
- [x] Server `POST /api/tx/submit` relay (native `submit_signed_tx` first — sidecar knows the per-route submitter; direct RPC fallback only when sidecar is down; 409+expired — never retry blindly)
- [x] Nightly signTransaction + signMessage both paths, typed TxError (rejected/expired/failed), toasts per phase
- [x] Browser-safe base64 codecs (no Node Buffer in client), MCP proxy validates wallet/body/args and honors upstream errors

## 02 Real agent loop (core winner) ✅
- [x] Intent parser (tiny, local): swap / transfer / stake / unstake / limit / orders / cancel / bridge / resolve / search (+ 23 unit tests)
- [x] Always: resolve mints via search_tokens -> quote BOTH aggregators (cookiebox + cookiescan, survivor wins) -> paper ticket with venue + also-quoted line -> `trade` with winning aggregator -> needs_signature -> Nightly sign -> confirm -> Cookiescan link
- [x] Decoded summary guard per kind (mint-aware: symbols lie, mints don't; incl. limit price, bridge amount+token) before sign; refuse on mismatch

## 03 DCA / limit-stop bot ✅ (partial — keeper fills are sidecar-side)
- [x] UI: place_limit_order (limit + price), list via get_limit_orders, cancel via shared cancelLimitOrder helper (chat + pantry agree)
- [ ] Stop-loss trigger syntax + expiry countdown display (needs sidecar order schema)

## 04 DAS charts + activity 🔶 (partial)
- [x] Live throughput sparkline from polled slots (honest, no fake history) + activity/pool boards with signature links
- [ ] `api.cookiescan.io` token history -> candles/volume + portfolio PnL (needs DAS read path; recharts removed until then)

## 05 Bridge + names + launch 🔶 (partial)
- [x] Bridge quote ticket (cookie<->solana) + `.cook` resolve everywhere + token search
- [ ] bridge_status polling UI (tool proxied, no status board yet)
- [ ] MomoSwap launch/buy/sell readouts (guard: pre-graduation shares are not SPL)

## 06 Polish for submission
- [x] Naming final (Sous), single flat brand mark, error boundary + 404, empty/error/loading states, mobile tab rail
- [ ] Deployed public URL + env set, README program/token addresses, X thread video, Telegram post

> Rule for agents: touch `lib/chain/config.ts` for constants, never hardcode RPC/program IDs in components. Add every new MCP tool to ALLOW in `api/mcp/route.ts` + `lib/mcp/client.ts`. Verify each task: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
