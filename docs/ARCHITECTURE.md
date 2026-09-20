# Architecture — Sous v1

## Goal
Prove Cookie Chain's edge: sub-second finality + ~0.000005 COOK fees
make AI-driven micro-trading usable. Every money action is a real on-chain tx
signed by the user's Nightly wallet.

## Flow

```
[Browser: Next.js]
  connect Nightly (wallet-adapter, NightlyWalletAdapter first)
  display address (shortAddr + copy + disconnect)
       |
  chat input -> parseIntent (local, no network) -> ticket
       |
  POST /api/mcp {tool, args} + x-cookie-wallet   (reads + unsigned builders)
       |
  cookie-mcp (COOKIE_SIGNER=external, --http 8787)
  tools: chain_health, search_tokens, get_token_info, get_quote,
         get_balance, get_pools, stake_info, trade, transfer,
         stake/unstake, place_limit_order, get_limit_orders,
         cancel_limit_order, bridge, bridge_status, resolve_domain
       |
  returns data OR {status:'needs_signature', transactionBase64, blockhash, ...}
  (client unwraps the JSON-RPC envelope in callMcp, then checks status)
       |
  guardSummary(intent vs summary) — refuse on mismatch
       |
  Nightly signTransaction -> POST /api/tx/submit {signedTx, blockhash?, lvbh?}
  -> singleton Connection: sendRawTransaction + blockhash-aware confirm
  -> TxPass stepper (idle/quoting/awaiting_signature/sending/
     confirming/confirmed/failed) + Cookiescan link + sonner toast
```

Money moves (swap, transfer, stake, unstake, limit, bridge) ALWAYS go
through a paper QuoteTicket (orderKind + fireTool + fireArgs) and fire
only from the ticket. Rejected signatures return the ticket to
`proposed`; expired blockhashes 409 with `expired:true` and are never
resubmitted — the user re-fires for a fresh quote.

## Key invariants
1. Never `new Connection` outside `lib/chain/connection.ts`.
2. Never call cookie-mcp from browser directly. Always via `/api/mcp`.
3. Never put private keys in web env. MCP runs keyless (external-signer).
4. All chain constants in `lib/chain/config.ts` (RPC, programs, mints).
5. All explorer links via `lib/chain/explorer.ts`.
6. All chain writes go through `/api/tx/submit` (never blind retries).
7. Never sign when the sidecar summary contradicts the ticket.

## Data sources
- Reads: cookie-mcp tools (above) + live slot poll for the throughput sparkline.
- Swaps: dual-aggregator `get_quote` (cookiebox + cookiescan, best-out wins,
  loser shown as the also-quoted line; one failing venue never kills the ticket).
- Solana side: bridge quote ticket + `bridge_status` tooling (status board pending).
- DAS `https://api.cookiescan.io` base in config; token-history charts pending.

## Test strategy
`pnpm test` (vitest, no DOM needed): intent parser, MCP shape helpers,
slot unwrap, tx base64 codecs, cancel flow with mocked fetch.
Sidecar/wallet flows are verified manually (see README demo script).
