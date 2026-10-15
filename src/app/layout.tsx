import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";
import { SuccessPopupProvider } from "@/components/SuccessPopup";
import { AppShell } from "@/components/AppShell";
import { configuredSiteUrl } from "@/lib/site";

const display = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display",
  display: "swap",
});
const ui = Inter({ subsets: ["latin"], variable: "--font-ui", display: "swap" });

const siteUrl = configuredSiteUrl() || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "PaperVault — College papers. Always with you.",
    template: "%s · PaperVault",
  },
  description:
    "Find college past papers by subject, semester and test. Read public papers free, share collections with your class and contribute missing papers.",
  openGraph: {
    title: "PaperVault",
    description: "Find the right past papers. Share one collection with your class.",
    url: siteUrl,
    siteName: "PaperVault",
    type: "website",
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>
        <SuccessPopupProvider><AppShell>{children}</AppShell></SuccessPopupProvider>
      </body>
    </html>
  );
}
