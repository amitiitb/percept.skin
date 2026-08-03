import type { Metadata } from "next";

// Pure interstitial: logo + one CTA, no unique content of its own. Kept out
// of the index so it doesn't compete with the homepage for the same
// "AI skin analysis" queries, but still crawlable (not disallowed in
// robots.ts) so link equity from anything pointing here still flows.
export const metadata: Metadata = {
  title: "Get Started",
  alternates: { canonical: "/splash" },
  openGraph: { url: "/splash", title: "Get Started | Percept" },
  robots: { index: false, follow: true },
};

export default function SplashLayout({ children }: { children: React.ReactNode }) {
  return children;
}
