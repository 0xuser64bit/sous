# Security

Sous moves real money, so the trust boundary is explicit:

- **No keys in the web process.** The app never holds `COOKIE_PRIVATE_KEY`.
  The `cookie-mcp` sidecar runs keyless (`COOKIE_SIGNER=external`) and only
  returns unsigned transactions; signing happens client-side in the user's
  Nightly wallet.
- **Sidecar auth.** When the sidecar is hosted, set the same
  `MCP_AUTH_TOKEN` on both ends; the app forwards it as
  `Authorization: Bearer <token>`. Never expose the sidecar to the public
  internet without it.
- **Proxy hardening.** `/api/mcp` allowlists tools and validates
  wallet/body/args; `/api/tx/submit` caps body size, rate-limits, and
  returns 409 (never retry) on expired/duplicate submissions.
- **Headers.** `next.config.ts` sets `nosniff`, `DENY` framing, and a strict
  referrer policy.
- **Public env is public.** Anything under `NEXT_PUBLIC_*` ships to the
  browser — chain endpoints only, never secrets.

## Reporting

Found a vulnerability? Open a private security advisory on GitHub (or a
direct message to the maintainer) instead of a public issue. Please include
steps to reproduce and avoid moving mainnet funds beyond a minimal proof.
