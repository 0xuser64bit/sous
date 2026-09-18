<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Sous agent rules (package manager: pnpm only — never npm)
- Chain: Cookie Chain SVM. RPC `https://rpc.cookiescan.io`. Never hardcode RPC/program IDs in components — use `src/lib/chain/config.ts`.
- Connection singleton: `src/lib/chain/connection.ts`. Explorer links: `src/lib/chain/explorer.ts`.
- MCP: browser -> `POST /api/mcp {tool, args}` + `x-cookie-wallet`. Never expose private keys. Add new tools to ALLOW in `src/app/api/mcp/route.ts` AND `src/lib/mcp/client.ts`.
- Wallet: Nightly first (`NightlyWalletAdapter`). Always show address + tx status + Cookiescan link + error toast.
- Tx phases: `idle/quoting/awaiting_signature/sending/confirming/confirmed/failed` in `usePilotStore`.
- Brand: Sous (sous-chef). Mark `public/brand/sous-logo.svg` via `SousMark`. Loader `SousLoader`. Voice: Yes, Chef! / Preheating / Tasting / Plating.
- Build order: `TASKS.md` 00->06. Update `docs/BOUNTY.md` checkboxes as you ship.
- Verify each task: `pnpm typecheck && pnpm lint && pnpm build`.
