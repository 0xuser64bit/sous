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
    "Conversational trading on Cookie Chain. Quotes, swaps, staking, bridging — all through natural language. Powered by Nightly + cookie-mcp.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <WalletProviders>{children}</WalletProviders>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--bg-raised)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
