import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export', // Required for static export to be used in Chrome extension
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true, // Required for static export as default loader doesn't work
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // If you plan to serve the extension popup from a subpath (e.g. /popup.html instead of /index.html)
  // you might need to set assetPrefix and basePath if Next.js assets are not found.
  // For a simple popup at the root (index.html), this is usually not needed.
  // assetPrefix: './', // If assets are not loading correctly
};

export default nextConfig;
