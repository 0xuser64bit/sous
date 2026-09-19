import type { DataRow } from "@/lib/mcp/shapes";

/** Label/value rows for the context rail. Quiet, tabular, truncated. */
export function DataRows({ rows, more }: { rows: DataRow[]; more?: number }) {
  if (!rows.length) {
    return (
      <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        Nothing on the shelf.
      </p>
    );
  }
  return (
    <div className="min-w-0">
      <dl>
        {rows.map((r, i) => (
          <div
            key={`${r.label}-${i}`}
            className="flex items-baseline justify-between gap-3 py-1.5 text-[12.5px]"
          >
            <dt className="min-w-0 flex-1 truncate" style={{ color: "var(--text-secondary)" }} title={r.label}>
              {r.label}
            </dt>
            <dd
              className="max-w-[55%] shrink-0 truncate text-right font-mono tnum"
              style={{ color: "var(--text-primary)" }}
              title={r.value}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      {more ? (
        <p className="pt-1 font-mono text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
          +{more} more
        </p>
      ) : null}
    </div>
  );
}

export function RowsSkeleton({ lines = 3 }: { lines?: number }) {
  const widths = ["62%", "81%", "55%", "74%", "66%"];
  return (
    <div className="flex flex-col gap-2 py-1" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-[2px] animate-live"
          style={{ background: "var(--border-subtle)", width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}

export function RowsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 py-1">
      <p className="font-mono text-[11.5px] leading-relaxed break-words" style={{ color: "var(--error)" }}>
        {message.length > 140 ? `${message.slice(0, 140)}…` : message}
      </p>
      <button
        onClick={onRetry}
        className="flex min-h-[36px] items-center self-start text-[12px] font-medium transition-opacity hover:opacity-70"
        style={{ color: "var(--copper-bright)" }}
      >
        Retry →
      </button>
    </div>
  );
}

export function sidecarHint(message: string): string {
  if (/502|timeout|abort|fetch|network/i.test(message)) {
    return "Sidecar unreachable — run cookie-mcp locally (see README).";
  }
  return message;
}
