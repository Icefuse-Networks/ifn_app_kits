import type { NextConfig } from "next";
import { getSecurityHeaders, getAPISecurityHeaders, getStaticAssetHeaders } from "./src/config/security-headers";

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment (production only)
  output: isDev ? undefined : 'standalone',

  // Development performance optimizations
  reactStrictMode: !isDev, // Disable double-render in dev for faster hot reloads

  // Experimental features for faster development
  experimental: {
    // Faster module resolution
    optimizePackageImports: ['lucide-react', '@dnd-kit/core', '@dnd-kit/sortable'],
  },

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

  async rewrites() {
    return [
      { source: '/clear_server_data.php/:path*', destination: '/legacy/clear_server_data.php/:path*' },
      { source: '/core.php/:path*', destination: '/legacy/core.php/:path*' },
      { source: '/maps/:path*', destination: '/legacy/maps/:path*' },
      { source: '/mutes/:path*', destination: '/legacy/mutes/:path*' },
      { source: '/proxy.php/:path*', destination: '/legacy/proxy.php/:path*' },
      { source: '/redirection/:path*', destination: '/legacy/redirection/:path*' },
      { source: '/removeBannedUser.php/:path*', destination: '/legacy/removeBannedUser.php/:path*' },
      { source: '/staff/:path*', destination: '/legacy/staff/:path*' },
    ]
  },
};

export default nextConfig;
