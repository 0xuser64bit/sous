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
  chat input -> parseIntent (local, no network)
       |
  lib/pass/tickets.ts -> paper ticket ({tool, args} + what the user reads)
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
  lib/pass/fire.ts: readSummary -> guardSummary(ticket vs summary)
     identity  mints exact, symbols lenient
     economics output drift <=2%, floor never below quote, slippage
               never wider than disclosed
     refuse on mismatch — the wallet never opens
       |
  Nightly signTransaction -> POST /api/tx/submit {signedTx, submit?, blockhash?, lvbh?}
  -> submit_signed_tx on the sidecar's named route, else direct Cookie RPC
     (only when submit.via is cookie-rpc)
  -> TxPass stepper (idle/quoting/awaiting_signature/sending/
     confirming/confirmed/failed) + Cookiescan link + sonner toast
```

## Summary shapes

The sidecar does not use one summary shape, and reading them with a single
flat sweep silently finds nothing on the nested ones. `lib/mcp/summary.ts`
is the only place that knows them:

```
trade              { aggregator, input:{mint,symbol,amount},
                     output:{mint,symbol,expectedAmount,minAmount}, slippageBps }
transfer           { to, mint, symbol, amount }
place_limit_order  { kind, inputMint, outputMint, amount, order }
bridge (step 1)    { creates, recipient, tokenAccount }
stake / unstake    (absent — GuardResult.checked is false, and the UI says so)
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
7. Never sign when the sidecar summary contradicts the ticket — in
   identity or in economics. The sidecar re-quotes at fire time.
8. Never resolve a ticker that two mints answer to. Refuse and name both.
9. Never claim a fill that was not confirmed. A submit the relay could not
   confirm returns its signature with `pending: true`.

## Data sources
- Reads: cookie-mcp tools (above) + live slot poll for the throughput sparkline.
- Swaps: dual-aggregator `get_quote` (cookiebox + cookiescan, best-out wins,
  loser shown as the also-quoted line; one failing venue never kills the ticket).
- Solana side: bridge quote ticket + `bridge_status` tooling (status board pending).
- DAS `https://api.cookiescan.io` base in config; token-history charts pending.

## Test strategy
`pnpm test` (vitest, no DOM needed): intent parser, MCP shape helpers,
slot unwrap and chain-status classification, tx base64 codecs, the
sign-guard, the fire path (guard refusal never opens the wallet, bounded
intermediate steps, unconfirmed submits), cancel flow, and the server
route policy — all with mocked fetch.

Assertions run against `src/lib/__tests__/fixtures/sidecar.ts`, captured
verbatim from a live cookie-mcp. The first sign-guard was written and
tested against an invented flat shape, so it passed every test while doing
nothing at all on a real swap; tests that assert on made-up payloads assert
nothing. Re-capture the fixtures when the sidecar's shapes change.

Wallet signing itself is verified manually (see the README demo script) —
nothing in CI holds a key.
