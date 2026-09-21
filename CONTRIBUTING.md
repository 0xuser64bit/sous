# Contributing

## Setup

`pnpm` only — never npm. Then:

```bash
cp .env.example .env
pnpm install
pnpm dev          # needs the MCP sidecar running (see README)
```

## Verify every change

```bash
pnpm verify    # typecheck + lint + test + build
```

CI runs exactly this on every push and pull request, so a green local run
means a green CI run.

## Rules that matter

- Chain constants (RPC, programs, mints) live in `src/lib/chain/config.ts`.
  Never hardcode them in components. Never `new Connection` outside
  `src/lib/chain/connection.ts`; explorer links go via
  `src/lib/chain/explorer.ts`.
- New MCP tools must be allowlisted in **both**
  `src/app/api/mcp/route.ts` (`ALLOW`) and `src/lib/mcp/client.ts`
  (`McpTool`).
- All chain writes go through `POST /api/tx/submit`. Never retry an
  expired quote — surface the 409 and let the user re-fire.
- Never sign when the sidecar summary contradicts the ticket — in identity
  (mints, amounts, destination) or in economics (output drift, the
  guaranteed floor, the slippage cap). Refuse loudly.
- Never resolve a ticker that two mints answer to, and never claim a fill
  that was not confirmed.
- Tests that touch a sidecar payload assert against
  `src/lib/__tests__/fixtures/sidecar.ts`, captured from a live cookie-mcp.
  Do not invent a shape — a guard tested against an imagined payload passed
  every test while doing nothing on a real swap. Re-capture instead.
- UI changes must follow `docs/DESIGN.md` (one copper accent, paper means
  money, tabular numbers, no shadows).
