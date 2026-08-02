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
    url: "/splash",
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
  // Two entries so the browser chrome matches the theme on first paint. The
  // toggle rewrites the active one at runtime (components/ui/ThemeToggle.tsx)
  // for the case where the stored choice disagrees with the OS preference.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E8E7E5" },
    { media: "(prefers-color-scheme: dark)", color: "#08201D" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script below sets data-theme on this
    // element before React hydrates, so server and client markup differ here by
    // design. Scoped to <html>, so a real mismatch anywhere else still warns.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Satoshi via Fontshare's CDN API, self-hosting the font file needs ITF's written consent */}
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap" />
        {/* Stamps the theme before first paint. Without it a dark-mode visitor
            gets a full frame of beige on every navigation, which is worse than
            no dark mode at all. A stored choice wins over the OS preference.

            It also collapses the two media-scoped theme-color tags above into a
            single unconditional one. Those tags answer the OS preference, so a
            visitor who chose dark on a light-set phone got a dark page under a
            beige address bar until they touched the toggle. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('glowmetry-theme');var t=(s==='dark'||s==='light')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].remove();var n=document.createElement('meta');n.name='theme-color';n.content=t==='dark'?'#08201D':'#E8E7E5';document.head.appendChild(n);}catch(e){document.documentElement.dataset.theme='light';}})();`,
          }}
        />
      </head>
      <ReactLenis root>
        <body className="antialiased">
          {children}
        </body>
      </ReactLenis>
    </html>
  );
}
