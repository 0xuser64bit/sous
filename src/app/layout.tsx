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

export const metadata: Metadata = {
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
  },
  twitter: {
    card: "summary",
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
