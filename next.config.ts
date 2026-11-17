import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  async headers() {
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self' https://paddle-model-ecology.bj.bcebos.com https://cdn.jsdelivr.net",
      "font-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob:",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "worker-src 'self' blob:"
    ].join("; ");
    return [{
      source: "/ocr/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=86400" }]
    }, {
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" }
      ]
    }];
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
      // The main-thread Safari path must not load the JSEP/WebGPU runtime.
      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-web$": join(process.cwd(), "node_modules/onnxruntime-web-ocr/dist/ort.wasm.min.mjs")
      };
    }
    return config;
  },
  outputFileTracingIncludes: {
    "/api/actualizacion-datos/base/plantilla": ["./resources/templates/plantilla-base-socios.xlsx"],
    "/api/souvenir/imprimir": ["./public/fonts/Vera.ttf", "./public/fonts/VeraBd.ttf"]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  }
};

export default nextConfig;
