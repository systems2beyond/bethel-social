import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BibleBot } from "@/components/Chat/BibleBot";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Caveat } from "next/font/google";
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bethel Metropolitan Baptist Church",
  description: "Community Platform",
};

import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/Layout/AppShell";
import { GlobalErrorBoundary } from "@/components/Debug/GlobalErrorBoundary";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} antialiased`}
      >
        <Providers>
          <GlobalErrorBoundary>
            <AppShell>
              {children}
            </AppShell>
          </GlobalErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
