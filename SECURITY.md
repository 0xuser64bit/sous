# Security

Sous moves real money, so the trust boundary is explicit:

- **No keys in the web process.** The app never holds `COOKIE_PRIVATE_KEY`.
  The `cookie-mcp` sidecar runs keyless (`COOKIE_SIGNER=external`) and only
  returns unsigned transactions; signing happens client-side in the user's
  Nightly wallet.
- **The sidecar authenticates nothing.** `cookie-mcp` has no auth flag and
  no auth env var; it will serve anyone who can reach it. `MCP_AUTH_TOKEN`
  is forwarded by this app as `Authorization: Bearer <token>`, but the
  sidecar never checks it — a reverse proxy in front of it has to. The
  supported deployment keeps the sidecar on loopback inside the app's own
  container (see the `Dockerfile`), where nothing outside can reach it.
  Bind it wider (`--host`) only behind a proxy that enforces auth.
- **Proxy hardening.** `/api/mcp` allowlists tools and validates
  wallet/body/args; `/api/tx/submit` caps body size, rate-limits, and
  returns 409 (never retry) on expired/duplicate submissions.
- **Headers.** `next.config.ts` sets `nosniff`, `DENY` framing, a strict
  referrer policy, a `Permissions-Policy` denying camera/mic/geolocation/
  payment/usb, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, HSTS
  in production, and `Cache-Control: no-store` on `/api/*` so balances never
  land in a shared cache.
- **CSP is partial, on purpose.** The policy sets `frame-ancestors 'none'`,
  `object-src 'none'`, `base-uri 'self'` and `form-action 'self'`. It does
  **not** constrain `script-src` or `connect-src`. Next's App Router inlines
  its flight payload, so a strict `script-src` needs per-request nonces from
  middleware and would force every page to render dynamically;
  `'unsafe-inline'` would be a policy that looks strict and stops nothing.
  `connect-src` stays open because the browser reaches the Cookie RPC
  directly through the wallet adapter and each adapter calls its own
  endpoints. Treat XSS as unmitigated by CSP here and rely on React's
  escaping, the tool allowlist, and the sign-guard.
- **The MCP proxy is unauthenticated.** Anyone who can reach `/api/mcp` can
  ask the sidecar to build an unsigned transaction for any wallet address.
  That leaks nothing signable — the browser wallet is the only signer — but
  it does make a public deployment a free relay to your sidecar. The
  allowlist keeps it to 17 read/build tools, and both routes are rate
  limited per instance; put real auth in front of it before running this
  anywhere that matters.
- **Public env is public.** Anything under `NEXT_PUBLIC_*` ships to the
  browser — chain endpoints only, never secrets.

## Reporting

Found a vulnerability? Open a private security advisory on GitHub (or a
direct message to the maintainer) instead of a public issue. Please include
steps to reproduce and avoid moving mainnet funds beyond a minimal proof.
