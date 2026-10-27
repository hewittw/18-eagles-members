import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist_Mono, Libre_Franklin, Newsreader, Oswald } from "next/font/google";
import "./globals.css";

// Type matched to masters.com, with open-licensed equivalents (its own faces are commercial):
// Tiempos Headline → Newsreader (headlines and notes), Benton Sans → Libre Franklin (interface),
// Oswald (the leaderboard numerals, the same face masters.com uses). Self-hosted at build by next/font.
const newsreader = Newsreader({ weight: ["400", "500", "600"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-newsreader" });
const franklin = Libre_Franklin({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-franklin" });
const oswald = Oswald({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--font-oswald" });
// The hub's progress labels still use font-mono.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "18 Eagles · Assignment 3", template: "%s · 18 Eagles" },
  description: "A personal golf round journal: play hole by hole, keep every card, and watch your handicap move.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${franklin.variable} ${oswald.variable} ${geistMono.variable} h-full bg-paper text-ink antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink">
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}