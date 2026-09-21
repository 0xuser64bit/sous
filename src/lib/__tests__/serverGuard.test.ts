import { describe, expect, it, afterEach } from "vitest";
import {
  clientIp,
  createRateLimiter,
  upstreamAuthHeaders,
} from "@/lib/server/guard";
import { submitRouteOf } from "@/lib/server/submitRoute";

const TOKEN_KEY = "MCP_AUTH_TOKEN";
const savedToken = process.env[TOKEN_KEY];

afterEach(() => {
  if (savedToken === undefined) delete process.env[TOKEN_KEY];
  else process.env[TOKEN_KEY] = savedToken;
});

describe("upstreamAuthHeaders", () => {
  it("sends nothing when no shared secret is configured", () => {
    delete process.env[TOKEN_KEY];
    expect(upstreamAuthHeaders()).toEqual({});
  });

  it("forwards the secret as a Bearer token when configured", () => {
    process.env[TOKEN_KEY] = "s3cret";
    expect(upstreamAuthHeaders()).toEqual({ authorization: "Bearer s3cret" });
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://localhost/api/mcp", { headers });

  it("reads the hop our proxy appended, not the one the caller sent", () => {
    // Caddy appends, so the rightmost entry is the real peer. Taking the
    // leftmost took whatever the caller put there.
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("cannot be shaken off by seeding the header", () => {
    // Same caller, different spoofed prefixes: one bucket, or the limiter
    // is decorative on the one route that is an open relay.
    const seen = new Set(
      ["9.9.9.9", "8.8.8.8", "7.7.7.7"].map((spoof) =>
        clientIp(req({ "x-forwarded-for": `${spoof}, 203.0.113.7` })),
      ),
    );
    expect([...seen]).toEqual(["203.0.113.7"]);
  });

  it("handles a single-hop header and stray whitespace", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-forwarded-for": " 1.1.1.1 ,  203.0.113.7 " }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-forwarded-for": " , " }))).toBe("local");
  });

  it("falls back to x-real-ip, then local", () => {
    expect(clientIp(req({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(req({}))).toBe("local");
  });
});

describe("createRateLimiter", () => {
  it("allows limit hits then blocks with a retry hint", () => {
    const check = createRateLimiter(3, 60_000);
    expect(check("a", 0)).toEqual({ ok: true });
    expect(check("a", 1)).toEqual({ ok: true });
    expect(check("a", 2)).toEqual({ ok: true });
    const blocked = check("a", 3);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after the window and isolates keys", () => {
    const check = createRateLimiter(1, 60_000);
    expect(check("a", 0).ok).toBe(true);
    expect(check("a", 1).ok).toBe(false);
    expect(check("b", 1).ok).toBe(true);
    expect(check("a", 60_000).ok).toBe(true);
  });
});

describe("submitRouteOf", () => {
  it("treats a missing hint as Cookie Chain", () => {
    expect(submitRouteOf(undefined)).toEqual({ via: "cookie-rpc", canFallBackDirect: true });
    expect(submitRouteOf({})).toEqual({ via: "cookie-rpc", canFallBackDirect: true });
    expect(submitRouteOf("nonsense")).toEqual({ via: "cookie-rpc", canFallBackDirect: true });
  });

  it("refuses the direct fallback for routes it cannot speak", () => {
    // Live: a bridge's first leg comes back { via: "solana-rpc" } with a
    // Solana lastValidBlockHeight (~427,000,000) against Cookie Chain's
    // ~25,900,000. Pushing those bytes at the Cookie RPC would fail on an
    // unrecognisable blockhash and then mis-read the expiry check.
    expect(submitRouteOf({ via: "solana-rpc" })).toEqual({
      via: "solana-rpc",
      canFallBackDirect: false,
    });
    expect(submitRouteOf({ via: "candyshop" }).canFallBackDirect).toBe(false);
  });

  it("allows the fallback on the route it does speak", () => {
    expect(submitRouteOf({ via: "cookie-rpc" }).canFallBackDirect).toBe(true);
  });
});
