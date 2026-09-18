import { unwrapMcp } from "@/lib/mcp/shapes";
import { pickKey } from "@/lib/utils/format";

/**
 * Extract a displayable slot from a raw `chain_health` MCP response.
 * Handles the JSON-RPC envelope (unwrapped tolerantly) and both
 * numeric and string slot shapes. Returns null when the sidecar
 * gave us nothing usable — callers render "Quiet"/offline.
 */
export function slotOf(raw: unknown): string | null {
  const data = unwrapMcp(raw);
  if (typeof data === "string") {
    const m = data.match(/\b\d{5,}\b/);
    return m ? m[0] : null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const slot = pickKey(data as Record<string, unknown>, ["slot"]);
  if (typeof slot === "number" && Number.isFinite(slot))
    return Math.floor(slot).toLocaleString("en-US");
  if (typeof slot === "string" && slot.length < 24 && slot.length > 0) return slot;
  return null;
}
