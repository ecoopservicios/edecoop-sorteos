import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    }
    return config;
  },
  outputFileTracingIncludes: {
    "/api/souvenir/imprimir": ["./public/fonts/Vera.ttf", "./public/fonts/VeraBd.ttf"]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  }
};

export default nextConfig;
