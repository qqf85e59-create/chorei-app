import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel deployment settings
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.attax.co.jp",
      },
    ],
  },
};

export default nextConfig;
