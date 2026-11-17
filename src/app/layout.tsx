import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Serif, Unbounded } from "next/font/google";
import "./globals.css";
import { THEME_BOOT } from "@/components/theme.tsx";

// Editorial italic accent for greetings. next/font self-hosts it at build time, so it works offline.
const serif = Instrument_Serif({ weight: "400", style: "italic", subsets: ["latin"], variable: "--font-instrument", display: "swap" });
// Wide display face for the shop's wordmark and a few headline figures.
const display = Unbounded({ weight: ["600", "700"], subsets: ["latin"], variable: "--font-unbounded", display: "swap" });

export const metadata: Metadata = {
  title: "Barbershop Manager",
  description: "Ventes, paie du personnel, dépenses et bénéfices pour un salon de coiffure avec manucure, pédicure et boissons. / Sales, staff pay, expenses and profit for a barbershop.",
  manifest: "/manifest.webmanifest",
  applicationName: "Barbershop Manager",
  appleWebApp: { capable: true, title: "Barbershop", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
  // The app has its own French/English switch: stop Chrome auto-translating (it rewrites the page and breaks it).
  other: { "mobile-web-app-capable": "yes", google: "notranslate" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The on-screen keyboard shrinks the layout (like a native app) instead of covering the bottom bar.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f2ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0a09" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_BOOT may set data-theme on <html> before React hydrates.
    <html lang="fr" translate="no" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${serif.variable} ${display.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
