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
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

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
- Never sign when the sidecar summary contradicts the ticket; refuse loudly.
- UI changes must follow `docs/DESIGN.md` (one copper accent, paper means
  money, tabular numbers, no shadows).
