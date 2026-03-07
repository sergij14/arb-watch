import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Partial Prerendering — static shell streamed instantly, dynamic tiles deferred
  cacheComponents: true,
};

export default nextConfig;
