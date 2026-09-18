import { unwrapMcp } from "@/lib/mcp/shapes";
import { pickKey } from "@/lib/utils/format";

/**
 * Extract a displayable slot from a raw `chain_health` MCP response.
 * Real shape: { healthy, slots: { processed, confirmed, finalized },
 * absoluteSlot, blockHeight, ... } — no top-level `slot` key.
 * Returns null when the sidecar gave us nothing usable — callers
 * render "Quiet"/offline.
 */
export function slotOf(raw: unknown): string | null {
  const data = unwrapMcp(raw);
  if (typeof data === "string") {
    const m = data.match(/\b\d{5,}\b/);
    return m ? m[0] : null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  const direct = pickKey(o, ["slot", "absoluteSlot", "absolute_slot", "blockHeight", "block_height"]);
  const hit = fmtSlot(direct);
  if (hit) return hit;
  const nested = pickKey(o, ["slots"]);
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    const inner = pickKey(n, ["confirmed", "processed", "finalized", "absoluteSlot"]);
    const hitInner = fmtSlot(inner);
    if (hitInner) return hitInner;
  }
  return null;
}

function fmtSlot(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.floor(v).toLocaleString("en-US");
  }
  if (typeof v === "string" && /^\d[\d,]{4,23}$/.test(v)) return v;
  return null;
}
