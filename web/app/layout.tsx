import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "SignalFlow",
  description: "Algorithmic stock signals, simplified",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className={`${inter.variable} font-sans antialiased h-full`}
        style={{ background: "var(--sf-bg)", color: "var(--sf-text)" }}>
        {children}
      </body>
    </html>
  );
}
