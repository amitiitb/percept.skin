import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Glowmetry | AI Skin Analysis",
    short_name: "Glowmetry",
    description: "Personalised AI skin analysis and dermatologist-backed plans.",
    start_url: "/start",
    display: "standalone",
    background_color: "#FAF9F6",
    theme_color: "#FAF9F6",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
