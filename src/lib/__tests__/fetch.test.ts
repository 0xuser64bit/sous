import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchWithTimeout } from "../utils/fetch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchWithTimeout", () => {
  it("passes through a fast response with the abort signal attached", async () => {
    let seenSignal: AbortSignal | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        seenSignal = (init?.signal as AbortSignal) ?? null;
        return new Response("ok");
      }),
    );
    const res = await fetchWithTimeout("/api/mcp", {}, 1000);
    expect(await res.text()).toBe("ok");
    expect(seenSignal).toBeInstanceOf(AbortSignal);
  });

  it("throws a timeout error (containing 'timeout') when fetch hangs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("The operation was aborted.", "AbortError")),
            );
          }),
      ),
    );
    await expect(fetchWithTimeout("/api/mcp", {}, 20)).rejects.toThrow(/timeout/i);
  });

  it("rethrows non-timeout network errors untouched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Load failed");
      }),
    );
    await expect(fetchWithTimeout("/api/mcp", {}, 1000)).rejects.toThrow("Load failed");
  });

  it("maps an AbortError from cancellation to an aborted error", async () => {
    const err = new DOMException("The operation was aborted.", "AbortError");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw err;
      }),
    );
    // Long timeout so the abort must come from fetch itself, not the timer.
    await expect(fetchWithTimeout("/api/mcp", {}, 60_000)).rejects.toThrow(/abort/i);
  });
});
