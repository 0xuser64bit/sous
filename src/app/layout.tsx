import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Sous — Your sous-chef for Cookie Chain",
  description:
    "Sous preps, tastes, and plates your Cookie Chain moves: quotes, swaps, stake, LPs, bridge. Nightly + Cookiebox + DAS + cookie-mcp. Yes, Chef!",
  icons: { icon: "/brand/sous-logo.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0a0b] text-white">
        <WalletProviders>{children}</WalletProviders>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
