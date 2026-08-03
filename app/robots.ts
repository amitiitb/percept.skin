import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://percept.skin";

// Everything below is account-specific, mid-funnel, or has no unique content
// for a crawler to index — keep it out. List kept in sync with the actual
// route folders in app/, not the pre-relaunch route names.
const PRIVATE_PATHS = [
  "/onboard", "/scan-prep", "/capture", "/checkout", "/bundle",
  "/auth/", "/dashboard", "/history", "/profile-setup", "/plans",
  "/report", "/settings", "/perceptgpt", "/api/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      // Explicit entries for AI/answer-engine crawlers so GEO intent is
      // legible in the file itself, not just inherited from the "*" group.
      { userAgent: "GPTBot", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "ClaudeBot", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "PerplexityBot", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "Google-Extended", allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
