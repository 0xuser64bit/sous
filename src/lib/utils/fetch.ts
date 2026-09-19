/**
 * fetch with a hard timeout. Browser fetch never times out on its own —
 * without this, a hung sidecar or relay hangs the UI forever with the
 * ticket stuck on "firing". Errors deliberately contain the word
 * "timeout" so errText/sidecarHint route them to sidecar guidance.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms = 30_000,
): Promise<Response> {
  const ctrl = new AbortController();
  const ownSignal = init.signal;
  const timer = setTimeout(() => ctrl.abort(), ms);

  // Honor a caller-provided signal too: either side aborts the request.
  if (ownSignal) {
    if (ownSignal.aborted) {
      clearTimeout(timer);
      ctrl.abort();
    } else {
      ownSignal.addEventListener("abort", () => ctrl.abort(), { once: true });
    }
  }

  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (ctrl.signal.aborted && !isAbortError(e)) {
      throw new Error(
        `Request timed out (timeout after ${Math.round(ms / 1000)}s) — is the service reachable?`,
      );
    }
    if (isAbortError(e)) {
      throw new Error(`Request aborted (timeout after ${Math.round(ms / 1000)}s).`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof Error && e.name === "AbortError") ||
    (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError")
  );
}
