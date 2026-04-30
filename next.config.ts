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
  // Prevent browsers from caching stale page/data responses
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
