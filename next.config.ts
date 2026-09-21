import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy, deliberately partial.
 *
 * The four directives below are the ones that can be set without a nonce
 * and without any chance of breaking a wallet:
 *
 *   frame-ancestors  nobody frames a signing UI (and it backs X-Frame-Options
 *                    for browsers that honour CSP over the older header)
 *   object-src       no plugins, ever
 *   base-uri         a <base> injection cannot repoint every relative URL
 *   form-action      a posted form cannot leave this origin
 *
 * `script-src` is NOT locked down here. Next's App Router inlines its flight
 * payload, so a strict policy needs per-request nonces from middleware,
 * which would force every page to render dynamically — and `'unsafe-inline'`
 * would be a policy that looks strict and stops nothing. `connect-src` is
 * also left open: the browser talks to the Cookie RPC directly through the
 * wallet adapter, and the adapters for Nightly, Phantom and Solflare each
 * reach their own endpoints. Narrowing it without a real wallet to test
 * against risks breaking the one flow the product exists for.
 *
 * SECURITY.md says the same thing, so nobody reads this file and assumes
 * more protection than is here.
 */
const CSP = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here needs a camera, a microphone, a location or a
          // payment handler. Deny them so injected code cannot ask either.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // Wallet adapters open popups, so full cross-origin isolation is
          // out — but a popup still must not get a handle on this window.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
      {
        // Wallet balances and chain state must never sit in a shared cache.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
