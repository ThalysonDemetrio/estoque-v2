import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // turbopack: {
  //   root: process.cwd(),
  // },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: process.env.BACKEND_INTERNAL_URL || "http://localhost:3001/api/:path*", // Proxy routing dinâmico
      },
    ];
  },
};

export default nextConfig;
