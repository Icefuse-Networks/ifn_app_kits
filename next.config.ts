import type { NextConfig } from "next";
import { getSecurityHeaders, getAPISecurityHeaders, getStaticAssetHeaders } from "./src/config/security-headers";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days cache
    remotePatterns: [
      // Steam avatars
      {
        protocol: 'https',
        hostname: 'avatars.steamstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'steamcdn-a.akamaihd.net',
      },
      // Discord avatars
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
      // Icefuse CDN
      {
        protocol: 'https',
        hostname: 'cdn.icefuse.com',
      },
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
      // Rust item icons
      {
        protocol: 'https',
        hostname: 'rustlabs.com',
      },
    ],
  },

  // SECURITY: Apply security headers to all routes
  async headers() {
    return [
      // Security headers for all pages
      {
        source: '/:path*',
        headers: getSecurityHeaders(),
      },
      // Stricter headers for API routes (no caching)
      {
        source: '/api/:path*',
        headers: getAPISecurityHeaders(),
      },
      // Static assets (long cache)
      {
        source: '/_next/static/:path*',
        headers: getStaticAssetHeaders(),
      },
    ]
  },
};

export default nextConfig;
