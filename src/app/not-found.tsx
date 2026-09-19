import Link from "next/link";
import { SousMark } from "@/components/brand/SousMark";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <SousMark size={44} />
      <h1 className="font-display text-balance text-[clamp(1.5rem,6vw,1.75rem)] font-semibold">
        Not on the menu.
      </h1>
      <p className="max-w-sm text-balance text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        That page left the pass. The trading floor moved one door down — back to it.
      </p>
      <Link
        href="/app"
        className="mt-2 flex min-h-[48px] items-center justify-center rounded-[var(--radius-md)] px-6 py-2.5 text-[13.5px] font-semibold transition-opacity hover:opacity-85"
        style={{ background: "var(--copper)", color: "#1d1206" }}
      >
        Back to the pass
      </Link>
    </div>
  );
}
