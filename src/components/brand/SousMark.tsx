import Image from "next/image";

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
      alt="Sous"
      width={size}
      height={size}
      priority
      className={className}
    />
  );
}
