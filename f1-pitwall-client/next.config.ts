import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Required for Docker deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
