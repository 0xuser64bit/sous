// pnpm-safe chain health check (no $npm_config_* vars).
// Usage: pnpm chain:health
const rpc =
  process.env.NEXT_PUBLIC_COOKIE_RPC_URL ?? "https://rpc.cookiescan.io";

try {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot" }),
  });
  const json = await res.json();
  console.log(`RPC ${rpc} slot:`, json.result ?? json);
} catch (e) {
  console.error(`RPC ${rpc} unreachable:`, e instanceof Error ? e.message : e);
  process.exit(1);
}
