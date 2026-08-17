import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pinned explicitly. Turbopack infers the root by walking up for a lockfile
    // (package-lock.json / yarn.lock / pnpm-lock.yaml / bun.lock), and a stray
    // package-lock.json in the home directory above this project wins that
    // search — which rooted the build at ~ and left the app resolving through
    // "../../../My Projects/Ongoing Projects/Percept Skin/...". Files outside
    // the inferred root are not resolved and this project's .env files stop
    // feeding NEXT_PUBLIC_ inlining, so the browser sees undefined for every
    // NEXT_PUBLIC_ var and Supabase throws "URL and API key are required".
    root: __dirname,
  },
};

export default nextConfig;
