import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://picsum.photos https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.tile.opentopomap.org https://tile.opentopomap.org https://*.opentopomap.org https://*.tile-cyclosm.openstreetmap.fr https://*.openstreetmap.fr https://*.basemaps.cartocdn.com https://cdnjs.cloudflare.com https://unpkg.com",
              "connect-src 'self' https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.tile.opentopomap.org https://tile.opentopomap.org https://*.opentopomap.org https://*.tile-cyclosm.openstreetmap.fr https://*.openstreetmap.fr https://*.basemaps.cartocdn.com https://routing.openstreetmap.de https://router.project-osrm.org https://brouter.de https://api.open-meteo.com https://generativelanguage.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com",
              "font-src 'self' data:",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
