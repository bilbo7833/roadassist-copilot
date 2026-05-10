import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin Turbopack to this folder so it never walks up to the parent and finds
  // a stray lockfile in case-study/ or above.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Hide the floating "N" dev-mode indicator so it doesn't cover the SMS
  // pane in the bottom-left of the demo. Production builds never show it.
  devIndicators: false,
};

export default nextConfig;
