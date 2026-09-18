# Architecture — Sous v0

## Goal
Prove Cookie Chain's edge: sub-second finality + ~0.000005 COOK fees + $0.05 deploys
make AI-driven micro-trading usable. Every money action is a real on-chain tx
signed by the user's Nightly wallet.

## Flow

```
[Browser: Next.js]
  connect Nightly (wallet-adapter, NightlyWalletAdapter first)
  display address (shortAddr + copy + disconnect)
       |
  chat input -> POST /api/mcp {tool, args} + x-cookie-wallet
       |
[Next API: /api/mcp] -> cookie-mcp (COOKIE_SIGNER=external, --http 8787)
  tools: chain_health, search_tokens, get_quote, get_balance, get_pools,
         stake_info, trade, transfer, stake/unstake, place_limit_order,
         bridge, resolve_domain ...
       |
  returns data OR {status:'needs_signature', transactionBase64, blockhash, ...}
       |
[Browser] Nightly signTransaction -> sendRawTransaction(rpc.cookiescan.io)
  -> confirm -> TxStatusCard (idle/quoting/awaiting_signature/sending/
     confirming/confirmed/failed) + Cookiescan link + sonner toast
```

## Key invariants
1. Never `new Connection` outside `lib/chain/connection.ts`.
2. Never call cookie-mcp from browser directly. Always via `/api/mcp`.
3. Never put private keys in web env. MCP runs keyless (external-signer).
4. All chain constants in `lib/chain/config.ts` (RPC, programs, mints).
5. All explorer links via `lib/chain/explorer.ts`.

## Data sources
- Reads: cookie-mcp tools + `https://api.cookiescan.io` (DAS) for charts/history (TASK 04).
- Swaps: Cookiebox agg `https://agg.cookiebox.app` + Candy Shop, compared side-by-side.
- Solana side: Jupiter + Hyperlane bridge status (view only).

## Next steps (see TASKS.md)
- 02: real planner loop (intent -> get_quote both aggs -> trade -> submit_signed_tx server path)
- 03: limit/stop DCA bot UI
- 04: DAS charts (recharts) + activity feed + PnL
- 05: bridge + .cook + launchpad tabs
