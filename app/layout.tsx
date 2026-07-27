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
  themeColor: "#E8E7E5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Satoshi via Fontshare's CDN API, self-hosting the font file needs ITF's written consent */}
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap" />
        {/* Fraunces (Google Fonts, OFL license) — display serif paired with Satoshi for premium/editorial headlines */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&display=swap" />
      </head>
      <ReactLenis root>
        <body className="antialiased">
          {children}
        </body>
      </ReactLenis>
    </html>
  );
}
