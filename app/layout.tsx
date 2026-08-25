import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { ShellProvider } from "@/lib/shell-context";
import { GlobalCommandPalette } from "@/components/shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DevMind — Your Engineering Team's Memory",
  description:
    "Understand complex codebases faster. DevMind turns scattered engineering knowledge into one intelligent workspace.",
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
      <body>
        <ToastProvider>
          <ShellProvider>
            {children}
            <GlobalCommandPalette />
          </ShellProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
