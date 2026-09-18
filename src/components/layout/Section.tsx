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
    <section className="px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {label}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
