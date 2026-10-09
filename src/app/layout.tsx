import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";
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
    "A student-powered archive of question papers for engineering and higher-education colleges across India.",
  openGraph: {
    title: "PaperVault",
    description: "Your college. Your papers. Find. Learn. Contribute.",
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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
