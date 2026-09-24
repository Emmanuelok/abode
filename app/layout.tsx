import type { Metadata, Viewport } from "next";
import { PwaExperience } from "@/components/pwa-experience";
import { SHARE_IMAGE, SITE_DESCRIPTION, SITE_ORIGIN, SITE_TITLE } from "@/lib/seo";
import "./globals.css";
import "./redesign.css";
import "./collections.css";
import "./pwa.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: SITE_TITLE, template: "%s | Abode Ghana" },
  description: SITE_DESCRIPTION,
  applicationName: "Abode Ghana",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Abode" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website", locale: "en_GH", siteName: "Abode Ghana",
    title: SITE_TITLE, description: SITE_DESCRIPTION, images: [SHARE_IMAGE], url: SITE_ORIGIN,
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [SHARE_IMAGE] },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: "/favicon.svg",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#173f35", colorScheme: "light" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}<PwaExperience /></body>
    </html>
  );
}
