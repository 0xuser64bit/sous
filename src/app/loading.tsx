import { SousLoader } from "@/components/brand/SousLoader";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SousLoader step={0} />
    </div>
  );
}
