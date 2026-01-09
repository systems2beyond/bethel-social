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
import { Sidebar } from "@/components/Layout/Sidebar";
import { BottomBar } from "@/components/Layout/BottomBar";
import { OnboardingModal } from "@/components/Auth/OnboardingModal";
import { BibleProvider } from "@/context/BibleContext";
import BibleModal from "@/components/Bible/BibleModal";
import BibleStudyModalWrapper from "@/components/Bible/BibleStudyModalWrapper";
import { Toaster } from 'sonner';


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
          <BibleProvider>
            <div className="flex h-screen overflow-hidden">
              {/* Sidebar - Responsive */}
              <Sidebar />

              {/* Main Content Area */}
              <main className="flex-1 flex flex-col relative min-w-0 transition-colors duration-300">
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
            <BibleModal />
            <BibleStudyModalWrapper />
            <Toaster />
          </BibleProvider>
        </Providers>
      </body>
    </html>
  );
}
