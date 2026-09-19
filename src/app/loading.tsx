import { SousLoader } from "@/components/brand/SousLoader";

export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <SousLoader step={0} />
    </div>
  );
}
