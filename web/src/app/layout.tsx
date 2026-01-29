import type { Metadata } from "next";
import {
  Manrope,
  Newsreader,
  Source_Serif_4,
} from "next/font/google";
import "./globals.css";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import ToastProvider from "@/components/ToastProvider";

const manrope = Manrope({
  variable: "--font-modern",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-news",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-news-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WisdomBridge",
  description: "1:1 mentoring marketplace for experienced retirees and learners",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${manrope.variable} ${newsreader.variable} ${sourceSerif.variable} antialiased`}
      >
        <ToastProvider>
          <div className="min-h-screen bg-[var(--paper-100)] text-[var(--ink-900)]">
            <SiteNav />
            <div className="min-h-[calc(100vh-136px)]">{children}</div>
            <SiteFooter />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
