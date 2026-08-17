import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ReactLenis } from "@/utils/lenis";
import { ConsentBanner } from "@/components/ConsentBanner";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

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
  verification: {
    google: "muHM2nIanifLFaE9JRyM-Fkdmz7T3GRAlUue_s7Fyg0",
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
    { media: "(prefers-color-scheme: dark)", color: "#181B19" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script below sets data-theme on this
    // element before React hydrates, so server and client markup differ here by
    // design. Scoped to <html>, so a real mismatch anywhere else still warns.
    <html lang="en" suppressHydrationWarning className={geist.variable}>
      <head>
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
                  logo: "https://percept.skin/brand/percept-ai-logo.svg",
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
            __html: `(function(){try{var s=localStorage.getItem('percept-theme');var t=(s==='dark'||s==='light')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].remove();var n=document.createElement('meta');n.name='theme-color';n.content=t==='dark'?'#181B19':'#E8E7E5';document.head.appendChild(n);}catch(e){document.documentElement.dataset.theme='light';}})();`,
          }}
        />
      </head>
      <ReactLenis root>
        <body className="antialiased">
          {children}
          {/* Gates GA4/GTM/Contentsquare loading behind cookie consent —
              see Section 8 of /privacy. Nothing analytics-related fires
              until the visitor accepts. */}
          <ConsentBanner />
        </body>
      </ReactLenis>
    </html>
  );
}
