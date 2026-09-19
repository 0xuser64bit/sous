import Link from "next/link";
import { SousMark } from "@/components/brand/SousMark";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <SousMark size={44} />
      <h1 className="font-display text-[28px] font-semibold">
        Not on the menu.
      </h1>
      <p className="max-w-sm text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        That page left the pass. The trading floor moved one door down — back to it.
      </p>
      <Link
        href="/app"
        className="rounded-[var(--radius-md)] px-4 py-2.5 text-[13.5px] font-semibold transition-opacity hover:opacity-85"
        style={{ background: "var(--copper)", color: "#1d1206" }}
      >
        Back to the pass
      </Link>
    </div>
  );
}
