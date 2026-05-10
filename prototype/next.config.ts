import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin Turbopack to this folder so it never walks up to the parent and finds
  // a stray lockfile in case-study/ or above.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
