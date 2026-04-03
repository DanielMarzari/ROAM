import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header from "@/components/ui/Header";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ROAM — Routes · Outdoors · Adventure · Maps",
  description: "Explore hiking trails across the United States. Discover routes, terrain, and outdoor adventures.",
  keywords: ["hiking", "trails", "outdoor", "maps", "adventure", "nature"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="h-full flex flex-col font-[family-name:var(--font-geist)]">
        <Header />
        <main className="flex-1 min-h-0 relative overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
