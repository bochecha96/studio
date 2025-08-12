import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["*.brs.devtunnels.ms", "localhost:9002"]
    },
  },
  serverExternalPackages: ['puppeteer-core', 'puppeteer', 'whatsapp-web.js', 'chrome-aws-lambda'],
};

export default nextConfig;
