import type { ReactNode } from "react";

/** Eyebrow + hairline section header used across the rail and pass. */
export function Section({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="px-3 py-4 sm:px-4">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
        <h2
          className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {label}
        </h2>
        {action && <div className="flex shrink-0 items-center">{action}</div>}
      </div>
      {children}
    </section>
  );
}
