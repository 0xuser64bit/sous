# Bounty compliance — Build a cApp on Cookie Chain

## Required features (must all be visibly demoable)
- [x] Wallet connection (Nightly first) — `WalletProviders.tsx`
- [x] Display connected wallet address — `WalletButton.tsx`
- [x] Transaction execution — `signAndSend.ts` + ChatPanel
- [x] Transaction confirmation handling — `TxStatusCard.tsx` + `confirmTransaction`
- [x] Error handling + user feedback — TxPass expo strip + sonner toasts per phase + error tickets with sidecar hint + rail retry buttons
- [x] View app-specific data/activity — Pantry ledger + staking + Market chain/pools board
- [ ] Analytics/charts/dashboards where relevant — scaffolded; recharts in TASK 04
- [x] Utilize existing programs for liquidity/swaps/trading — quote → ticket → Nightly sign → confirm; venue + impact lines on the ticket (multi-agg compare in TASK 02 polish)
- [x] Clear transaction status updates — TxPhase state machine

## Optional integrations (more = more points)
- [x] Cookiebox agg wired (quote compare TODO)
- [ ] Cookieswap / Candy Shop compare
- [x] DAS api.cookiescan.io base in config (charts TODO)
- [x] Cookiescan links for every tx/address/token
- [x] cookie-mcp external-signer proxy (`/api/mcp`)
- [ ] MomoSwap launchpad tab
- [ ] bCOOK stake/unstake buttons (reads done)
- [ ] Hyperlane bridge tab + bridge_status polling
- [ ] .cook resolve + Baked Bazaar rewards

## Submission checklist
- [ ] Deployed public URL + env set
- [ ] GitHub public + README setup instructions (done, keep updated)
- [ ] Program/contract/token addresses listed
- [ ] X thread: what it does + how to use + bridge guide + video
- [ ] Thread shared in Telegram t.me/TheCookieNetChain

## 60s demo script
1. Connect Nightly (show address).
2. "Quote 10 COOK -> bCOOK" — show both aggregator quotes.
3. Approve in Nightly — show confirming (~1s) → confirmed + Cookiescan link.
4. Show staking APY + limit-order DCA set.
5. Punchline: "4 txs, <$0.01, 4 seconds. Only possible on Cookie Chain."
