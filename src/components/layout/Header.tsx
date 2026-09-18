import { WalletButton } from "@/components/wallet/WalletButton";
import { SousMark } from "@/components/brand/SousMark";
import { APP_NAME, APP_TAGLINE } from "@/lib/chain/config";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-amber-200/10 bg-gradient-to-r from-[#141007] to-transparent px-6 py-4">
      <div className="flex items-center gap-3">
        <SousMark size={40} />
        <div>
          <div className="font-bold leading-tight tracking-tight">
            {APP_NAME}
            <span className="ml-2 rounded-full border border-amber-300/30 px-2 py-0.5 align-middle text-[10px] font-medium uppercase tracking-widest text-amber-200/80">
              sous-chef
            </span>
          </div>
          <div className="text-xs text-white/50">{APP_TAGLINE} · Yes, Chef!</div>
        </div>
      </div>
      <WalletButton />
    </header>
  );
}
