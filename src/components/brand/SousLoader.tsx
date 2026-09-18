import { SousMark } from "./SousMark";

const LINES = ["Preheating oven…", "Tasting the sauce…", "Plating…"] as const;

/** Kitchen-themed loader. `step` 0..2 maps to a line. */
export function SousLoader({ step = 0 }: { step?: number }) {
  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <div className="animate-bounce">
        <SousMark size={32} />
      </div>
      <span className="text-sm text-white/70">
        {LINES[Math.min(step, LINES.length - 1)]}
      </span>
    </div>
  );
}
