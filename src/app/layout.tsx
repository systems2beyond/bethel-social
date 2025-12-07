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

export const metadata: Metadata = {
  title: "Bethel Metropolitan Baptist Church",
  description: "Community Platform",
};

import { Providers } from "@/components/Providers";
import { Sidebar } from "@/components/Layout/Sidebar";
import { BottomBar } from "@/components/Layout/BottomBar";
import { OnboardingModal } from "@/components/Auth/OnboardingModal";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white dark:bg-black`}
      >
        <Providers>
          <div className="flex h-screen overflow-hidden">
            {/* DEBUG BANNER */}
            <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-center py-2 z-[9999] font-bold shadow-lg">
              SYSTEM UPDATE: V3.0 - IF YOU SEE THIS, THE DEPLOYMENT WORKED
            </div>
            {/* Sidebar - Hidden on mobile, visible on desktop */}
            <div className="hidden md:block">
              <Sidebar />
            </div>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col relative min-w-0 bg-white dark:bg-black transition-colors duration-300">
              {/* Scrollable Feed Area */}
              <div className="flex-1 overflow-y-auto scroll-smooth pb-24">
                <div className="max-w-4xl mx-auto w-full">
                  {children}
                </div>
              </div>

              {/* Fixed Bottom Input Bar */}
              <BottomBar />
            </main>
          </div>
          <OnboardingModal />
        </Providers>
      </body>
    </html>
  );
}
