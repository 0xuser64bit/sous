# TASKS — agentic build order (do in order, one at a time)

## 00 Setup ✅
- [x] Next.js + TS + Tailwind + Solana deps + Nightly-first providers
- [x] Chain config, MCP proxy, TxStatus, chat shell, docs
- [ ] Verify: `npm run typecheck && npm run lint && npm run build` + `npm run dev` + connect Nightly on localhost

## 01 Harden signing path
- Server `submit_signed_tx` route (forward signed bytes via MCP submit path, handle blockhash expiry + "do not retry blindly").
- Nightly signTransaction + signMessage both paths. Sonner toasts for every phase. Paste failing cases into TASKS.

## 02 Real agent loop (core winner)
- Intent parser (tiny, local): swap / stake / transfer / limit-order.
- Always: `get_quote` BOTH aggregators -> show price impact/slippage/venue -> `trade` -> needs_signature -> sign -> confirm -> Cookiescan link.
- Show decoded summary (from, to, amount) before sign. Refuse to sign if summary mismatches request.

## 03 DCA / limit-stop bot
- UI: place_limit_order (limit + stop), list via get_limit_orders, cancel. Keeper-fill note + expiry handling.

## 04 DAS charts + activity
- `api.cookiescan.io` token history -> recharts candles/volume. Activity feed with signature links. Portfolio PnL.

## 05 Bridge + names + launch
- Bridge tab (cookie<->solana) + bridge_status polling + Solana COOK via Jupiter note.
- .cook resolve input everywhere an address is expected.
- MomoSwap launch/buy/sell readouts (guard: pre-graduation shares are not SPL).

## 06 Polish for submission
- Naming final, favicon/og, README addresses, deploy, record X thread video, post to Telegram.
- Empty/error/loading states everywhere. Mobile pass.

> Rule for agents: touch `lib/chain/config.ts` for constants, never hardcode RPC/program IDs in components. Add every new MCP tool to ALLOW in `api/mcp/route.ts` + `lib/mcp/client.ts`.
