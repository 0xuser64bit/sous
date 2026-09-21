import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { WalletProviders } from "@/components/providers/WalletProviders";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

/**
 * Absolute base for og:image and twitter:image. Without it Next resolves
 * them against localhost, and a scraper fetching the card gets nothing —
 * which is exactly how a shared link ends up with no preview.
 *
 * Empty-string env vars are real (a variable added without a value), and
 * `??` does not catch them, so this validates rather than defaults — the
 * same trap `lib/chain/config.ts` already documents.
 */
const SITE_URL = (() => {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  return /^https?:\/\/.+/.test(raw) ? raw : "https://sous.usevora.fun";
})();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Sous — Your sous-chef for Cookie Chain",
  description:
    "Fire swaps, stake, and limit orders on Cookie Chain in plain words. Quoted, signed in Nightly, served in ~1 second.",
  icons: { icon: "/brand/sous-logo.svg" },
  openGraph: {
    title: "Sous — Your sous-chef for Cookie Chain",
    description:
      "Fire swaps, stake, and limit orders on Cookie Chain in plain words. Quoted, signed in Nightly, served in ~1 second.",
    siteName: "Sous",
    type: "website",
    url: SITE_URL,
  },
  twitter: {
    // The wide card. "summary" is the small square thumbnail, which wastes
    // the one impression a link in a thread gets.
    card: "summary_large_image",
    title: "Sous — Your sous-chef for Cookie Chain",
    description:
      "Fire swaps, stake, and limit orders on Cookie Chain in plain words. Quoted, signed in Nightly, served in ~1 second.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141210",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <WalletProviders>{children}</WalletProviders>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--bg-raised)",
              border: "1px solid var(--border-strong)",
              color: "var(--text-primary)",
              fontSize: "13px",
              borderRadius: "5px",
              boxShadow: "none",
            },
          }}
        />
      </body>
    </html>
  );
}
