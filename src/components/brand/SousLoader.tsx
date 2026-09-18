import { SousMark } from "./SousMark";

const LINES = ["Preheating oven…", "Tasting the sauce…", "Plating…"] as const;

/** Kitchen-themed loader. `step` 0..2 maps to a line. */
export function SousLoader({ step = 0 }: { step?: number }) {
  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <div className="animate-gentle-pulse">
        <SousMark size={24} />
      </div>
      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        {LINES[Math.min(step, LINES.length - 1)]}
      </span>
    </div>
  );
}
