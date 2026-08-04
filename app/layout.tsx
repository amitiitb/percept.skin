import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ReactLenis } from "@/utils/lenis";

const description =
  "Personalised AI skin analysis and practical, dermatologist-backed plans, without surgery-first recommendations.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://percept.skin",
  ),
  title: {
    default: "Percept | See Your Skin More Clearly",
    template: "%s | Percept",
  },
  description,
  applicationName: "Percept",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Percept",
    title: "Percept | See Your Skin More Clearly",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Percept | See Your Skin More Clearly",
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
        {/* Fontshare serves the CSS from api.fontshare.com but the @font-face
            src urls it returns point at cdn.fontshare.com — preconnect both
            so the render-blocking stylesheet's actual font fetch isn't cold. */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        {/* Satoshi via Fontshare's CDN API, self-hosting the font file needs ITF's written consent */}
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://percept.skin/#organization",
                  name: "Percept",
                  url: "https://percept.skin/",
                  logo: "https://percept.skin/brand/percept-logo.png",
                  email: "support@percept.skin",
                  description,
                },
                {
                  "@type": "WebSite",
                  "@id": "https://percept.skin/#website",
                  name: "Percept",
                  url: "https://percept.skin/",
                  publisher: { "@id": "https://percept.skin/#organization" },
                },
              ],
            }),
          }}
        />
        {/* Stamps the theme before first paint. Without it a dark-mode visitor
            gets a full frame of beige on every navigation, which is worse than
            no dark mode at all. A stored choice wins over the OS preference.

            It also collapses the two media-scoped theme-color tags above into a
            single unconditional one. Those tags answer the OS preference, so a
            visitor who chose dark on a light-set phone got a dark page under a
            beige address bar until they touched the toggle. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('percept-theme');var t=(s==='dark'||s==='light')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].remove();var n=document.createElement('meta');n.name='theme-color';n.content=t==='dark'?'#08201D':'#E8E7E5';document.head.appendChild(n);}catch(e){document.documentElement.dataset.theme='light';}})();`,
          }}
        />
      </head>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-ELGVCD5CYZ"
        strategy="afterInteractive"
      />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-ELGVCD5CYZ');
          gtag('config', 'G-VBV34ETWWN');`}
      </Script>
      <Script
        src="https://t.contentsquare.net/uxa/f9da0da61a34e.js"
        strategy="afterInteractive"
      />
      <ReactLenis root>
        <body className="antialiased">
          {children}
        </body>
      </ReactLenis>
    </html>
  );
}
