/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['react-leaflet', 'leaflet'],
  experimental: {
    webpackBuildWorker: false,
  },
};

module.exports = nextConfig;
