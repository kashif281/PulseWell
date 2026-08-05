import type { NextConfig } from "next";
import path from "path";

const monorepoRoot = path.join(__dirname, "../..");
const apiPort = process.env.API_PORT || "5002";
const apiOrigin = process.env.API_INTERNAL_URL || `http://localhost:${apiPort}`;

const nextConfig: NextConfig = {
  turbopack: {
    // Resolve packages from the workspace root in this npm monorepo.
    root: monorepoRoot,
  },
  async redirects() {
    return [
      { source: '/loign', destination: '/login', permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiOrigin}/api/v1/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiOrigin}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
