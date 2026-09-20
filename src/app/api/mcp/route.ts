import { NextRequest, NextResponse } from "next/server";
import {
  clientIp,
  createRateLimiter,
  upstreamAuthHeaders,
} from "@/lib/server/guard";

/**
 * POST /api/mcp { tool, args }
 * Proxies to cookie-mcp in external-signer mode (COOKIE_SIGNER=external).
 * - Forwards x-cookie-wallet header so MCP knows the signer.
 * - Never holds private keys. Browser signs via Nightly.
 *
 * Run locally: COOKIE_SIGNER=external npx -y cookie-mcp --http 8787
 * Then MCP_HTTP_URL=http://127.0.0.1:8787/mcp
 */

const MCP_URL = process.env.MCP_HTTP_URL ?? "http://127.0.0.1:8787/mcp";
const TIMEOUT_MS = Number(process.env.MCP_TIMEOUT_MS ?? 45000);
/** Largest proxied body (tool args are small JSON; this blocks junk). */
const MAX_BODY_BYTES = 32 * 1024;

const ALLOW = new Set([
  "chain_health",
  "search_tokens",
  "get_token_info",
  "get_quote",
  "get_balance",
  "get_pools",
  "stake_info",
  "trade",
  "transfer",
  "stake",
  "unstake",
  "place_limit_order",
  "get_limit_orders",
  "cancel_limit_order",
  "bridge",
  "bridge_status",
  "resolve_domain",
]);

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Best-effort abuse throttle for an open proxy (per instance). */
const mcpLimiter = createRateLimiter(120, 60_000);

export async function POST(req: NextRequest) {
  const limited = mcpLimiter(clientIp(req));
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Rate limited — slow down, Chef." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const wallet = req.headers.get("x-cookie-wallet") ?? "";
  if (wallet && !BASE58.test(wallet)) {
    return NextResponse.json(
      { error: "Invalid wallet address in x-cookie-wallet" },
      { status: 400 },
    );
  }

  const raw = await req.text().catch(() => "");
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }
  let body: { tool?: unknown; args?: unknown };
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.tool !== "string" || !ALLOW.has(body.tool)) {
    return NextResponse.json(
      { error: `Tool not allowed: ${String(body.tool).slice(0, 64)}` },
      { status: 400 },
    );
  }
  if (body.args !== undefined && (typeof body.args !== "object" || body.args === null || Array.isArray(body.args))) {
    return NextResponse.json({ error: "args must be a JSON object" }, { status: 400 });
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(MCP_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...upstreamAuthHeaders(),
        ...(wallet ? { "x-cookie-wallet": wallet } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `sous-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        method: "tools/call",
        params: { name: body.tool, arguments: body.args ?? {} },
      }),
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `MCP ${body.tool} failed (upstream ${upstream.status}): ${text.slice(0, 300)}` },
        { status: 502 },
      );
    }
    // Streamable HTTP may return SSE; pass through as JSON if possible.
    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return new NextResponse(text, {
        status: upstream.status,
        headers: { "content-type": "text/event-stream" },
      });
    }
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? "MCP timeout — is cookie-mcp running? See README."
        : e instanceof Error
          ? e.message
          : "MCP proxy error";
    return NextResponse.json(
      { error: msg, hint: "Run: COOKIE_SIGNER=external npx -y cookie-mcp --http 8787" },
      { status: 502 },
    );
  } finally {
    clearTimeout(t);
  }
}
