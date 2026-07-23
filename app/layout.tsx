import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ReactLenis } from "@/utils/lenis";

const description =
  "Personalised AI skin analysis and practical, dermatologist-backed plans, without surgery-first recommendations.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://glowmetry.com",
  ),
  title: {
    default: "Glowmetry | See Your Skin More Clearly",
    template: "%s | Glowmetry",
  },
  description,
  applicationName: "Glowmetry",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/v2/splash",
    siteName: "Glowmetry",
    title: "Glowmetry | See Your Skin More Clearly",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Glowmetry | See Your Skin More Clearly",
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FAF9F6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <ReactLenis root>
        <body className="antialiased">
          {children}
        </body>
      </ReactLenis>
    </html>
  );
}
