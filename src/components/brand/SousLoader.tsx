import { SousMark } from "./SousMark";

const STEPS = ["Preheating", "Tasting", "Plating"] as const;

/**
 * Kitchen pass loader. A numbered step, not a spinner —
 * the user should always know which stage the order is at.
 */
export function SousLoader({ step = 0 }: { step?: number }) {
  const active = Math.min(Math.max(step, 0), STEPS.length - 1);
  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <SousMark size={22} />
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <span key={label} className="flex items-center gap-2">
            <span
              className="font-mono text-[11px] tnum"
              style={{
                color:
                  i === active ? "var(--copper-bright)" : "var(--text-tertiary)",
              }}
            >
              {i < active ? "✓" : `${i + 1}`}
            </span>
            <span
              className="text-xs"
              style={{
                color:
                  i === active
                    ? "var(--text-primary)"
                    : "var(--text-tertiary)",
              }}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className="mx-1 inline-block h-px w-4"
                style={{ background: "var(--border-strong)" }}
              />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
