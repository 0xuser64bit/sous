/**
 * One label/value line on an order slip: dashed leader, tabular value.
 *
 * Shared by the live ticket and by every illustration of one on the
 * landing page. Three near-identical copies of this had already drifted
 * apart, and a marketing ticket that renders differently from the real one
 * is a claim about a product that does not exist.
 */
export function TicketLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0" style={{ color: "var(--ink-soft)" }}>
        {label}
      </dt>
      <span aria-hidden className="leader mb-1 min-w-3 flex-1 sm:min-w-4" />
      <dd
        className={`min-w-0 max-w-[58%] truncate text-right font-mono tnum ${strong ? "font-semibold" : ""}`}
        style={{ color: "var(--ink)" }}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
