# 👨‍🍳 Sous — Your sous-chef for Cookie Chain

> Sous preps, tastes, and plates your Cookie Chain moves: quotes, swaps,
> stake, LPs, bridge. Nightly + Cookiebox + DAS + cookie-mcp (wallet-signed).
> Yes, Chef!

**Bounty:** Build a cApp on Cookie Chain. This repo is the entry.

Name decided: **Sous** (sous-chef). Tagline: "Your sous-chef for Cookie Chain".
Vibe: warm kitchen — chef's-hat cookie mark, amber/copper on dark, microcopy
in kitchen voice (Preheating / Tasting / Plating / Yes, Chef!).

## Quickstart (pnpm is the standard)

```bash
cp .env.example .env
pnpm install
# terminal 1: MCP in external-signer mode (no keys in app process)
COOKIE_SIGNER=external npx -y cookie-mcp --http 8787
# terminal 2: web app
pnpm dev
```

Open http://localhost:3000 (landing) → **Launch the pass** → `/app` → Connect **Nightly** → ask `Quote 10 COOK -> bCOOK`.

Health checks: `pnpm chain:health` (RPC slot) and `GET /api/health`.

> Why pnpm-only? Mixing npm + pnpm breaks installs. This repo standardizes on
> pnpm (`packageManager: pnpm@11.24.0`). `package-lock.json` is removed on
> purpose — do not reintroduce it. If `pnpm install` complains about
> ignored build scripts, `pnpm-workspace.yaml > allowBuilds` already pins the
> answer; don't hand-edit to placeholder strings.

## Scripts

| cmd | what |
|---|---|
| `pnpm dev` | Next.js dev |
| `pnpm build` | production build (must pass for submission) |
| `pnpm lint` | eslint |
| `pnpm typecheck` | tsc --noEmit |
| `pnpm test` | vitest unit suite (intent, shapes, tx, slot) |
| `pnpm chain:health` | RPC slot check (pnpm-safe, no npm vars) |

## Architecture

See `docs/ARCHITECTURE.md`. TL;DR:

- `src/lib/chain/` — RPC, program IDs, explorer links. Single source of truth.
- `src/app/api/mcp` — proxy to `cookie-mcp` (external-signer). Browser sends `{tool, args}` + `x-cookie-wallet`. Gets data or `{status:'needs_signature', transactionBase64}` (envelope unwrapped client-side).
- `src/app/api/tx/submit` — single on-chain write path. Native `submit_signed_tx` first (sidecar knows the route submitter), direct-RPC fallback only when the sidecar is down, never retries expired quotes blindly.
- `src/lib/mcp/` — validated proxy client (envelope unwrapped once, at the boundary), `tokens.ts` mint resolver (exact-match or refuse), `quotes.ts` dual-aggregator compare (cookiebox + cookiescan, survivor wins).
- `src/lib/intent.ts` — local intent parser (swap/send/stake/limit/bridge/names/search). No network, no guessing with money.
- `src/lib/tx/` — Nightly signing (transaction + message paths), typed `TxError` (rejected/expired/failed), shared limit-cancel flow.
- `src/components/terminal/` — chat pass, paper `QuoteTicket` per money move, `TxPass` stepper (bounty-required feedback).
- `src/components/dashboard/` — pantry (balances, stake quick-fire, standing orders) + market (chain pulse, pool board, live throughput sparkline).
- `src/components/brand/` — `SousMark` (chef-hat cookie SVG), `SousLoader` (Preheating/Tasting/Plating).

## Bounty fit

See `docs/BOUNTY.md` — required features checklist + optional integrations + demo script.

## Env

- `NEXT_PUBLIC_*` = public chain endpoints (safe).
- `MCP_HTTP_URL` = server-only URL to cookie-mcp. Never hold `COOKIE_PRIVATE_KEY` in web process.

## Deploy

Vercel / Railway / Fly. Set env vars from `.env.example`. App is read-only until MCP URL is set; wallet signing is client-side via Nightly.

## Submission (TODO)

- [ ] Live URL
- [ ] Program/token addresses used (list in README before submit)
- [ ] X thread + Telegram share
