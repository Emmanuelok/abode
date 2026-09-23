import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Abode Ghana | A home, beautifully yours",
  description: "Explore furniture, lighting, home essentials and thoughtful ideas for your home in Ghana. Plan your rooms and build your wishlist.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
