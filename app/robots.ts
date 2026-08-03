import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://percept.skin";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/start", "/privacy", "/terms"],
      // Funnel, auth, and account pages are user-specific — keep them out of the index
      disallow: [
        "/onboard", "/concerns", "/photo-prep", "/capture", "/details",
        "/processing", "/results", "/plan",
        "/auth/", "/dashboard", "/my-reports", "/profile", "/perceptgpt", "/api/",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
