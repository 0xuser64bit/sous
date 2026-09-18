import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export function SousMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand/sous-logo.svg"
      alt="Sous — chef hat over cookie"
      width={size}
      height={size}
      priority
      className={cn("rounded-xl", className)}
    />
  );
}
