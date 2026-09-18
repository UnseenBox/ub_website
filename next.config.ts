import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75, 90],
    // Long-lived: editors replace an image by changing its URL, not its bytes.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      // Google Drive (see lib/images/drive.ts for the normalisation rules)
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "drive.google.com", pathname: "/**" },
      { protocol: "https", hostname: "drive.usercontent.google.com", pathname: "/**" },
      // Images uploaded from the admin (Vercel Blob)
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/**" },
      // YouTube thumbnails for trailer facades
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
    ],
  },
  experimental: {
    serverActions: {
      // Admin saves can include many localized fields and URLs.
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/media/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
