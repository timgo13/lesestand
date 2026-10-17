import type { Metadata, Viewport } from "next";
import "./readable.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lesestand",
  description: "Webnovels mit demselben Lesestand auf Handy und PC.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffafa" },
    { media: "(prefers-color-scheme: dark)", color: "#222830" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
