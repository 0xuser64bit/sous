import { describe, expect, it, afterEach } from "vitest";
import {
  clientIp,
  createRateLimiter,
  upstreamAuthHeaders,
} from "@/lib/server/guard";

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

  it("prefers the first x-forwarded-for entry", () => {
    expect(
      clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })),
    ).toBe("1.2.3.4");
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
