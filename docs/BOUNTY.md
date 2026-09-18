# Bounty compliance — Build a cApp on Cookie Chain

## Required features (must all be visibly demoable)
- [x] Wallet connection (Nightly first) — `WalletProviders.tsx`
- [x] Display connected wallet address — `WalletButton.tsx` (address + copy + disconnect)
- [x] Transaction execution — ticket -> Nightly sign -> `POST /api/tx/submit` -> confirm (swap, send, stake, unstake, limit, bridge, cancel)
- [x] Transaction confirmation handling — blockhash-aware confirm + `TxPass` stepper + `TxError` rejected/expired/failed paths
- [x] Error handling + user feedback — TxPass expo strip + sonner toasts per phase + declined-signatures stay retryable + rail retry buttons + app error boundary
- [x] View app-specific data/activity — pantry ledger + stake quick-fire + standing-orders board + pool/market board
- [x] Analytics/charts/dashboards where relevant — live slots-per-poll throughput sparkline (DAS candles/PnL deferred to TASK 04)
- [x] Utilize existing programs for liquidity/swaps/trading — quote -> ticket -> Nightly sign -> confirm; venue + impact lines on the ticket
- [x] Clear transaction status updates — TxPhase state machine + signature + Cookiescan link on every fill

## Optional integrations (more = more points)
- [x] Cookiebox agg wired (venue line on tickets; full A/B compare needs sidecar quote shapes)
- [ ] Cookieswap / Candy Shop compare
- [x] DAS api.cookiescan.io base in config (slot sparkline live; token-history charts TODO)
- [x] Cookiescan links for every tx/address/token (chat fills, ledger tables, resolve results)
- [x] cookie-mcp external-signer proxy (`/api/mcp`, validated + allowlisted)
- [ ] MomoSwap launchpad tab
- [x] bCOOK stake/unstake buttons (pantry quick-fire writes pass tickets)
- [x] Hyperlane bridge tab (bridge quote ticket; `bridge`/`bridge_status` proxied, no status board yet)
- [x] .cook resolve + token search (chat + linkified tables)
- [ ] Baked Bazaar rewards

## Submission checklist
- [ ] Deployed public URL + env set
- [ ] GitHub public + README setup instructions (done, keep updated)
- [ ] Program/contract/token addresses listed
- [ ] X thread: what it does + how to use + bridge guide + video
- [ ] Thread shared in Telegram t.me/TheCookieNetChain

## 60s demo script
1. Connect Nightly (show address).
2. "Quote 10 COOK -> bCOOK" — ticket with venue + impact, fire in Nightly.
3. Approve in Nightly — show confirming (~1s) → confirmed + Cookiescan link.
4. Pantry: stake 5 via quick-fire ticket; "Limit buy 5 COOK → USDC at 0.5" → standing-orders board; scrap it.
5. Punchline: "5 txs, <$0.01, seconds. Only possible on Cookie Chain."
