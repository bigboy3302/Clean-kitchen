/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    // keep your ZXing optimization
    optimizePackageImports: ['@zxing/browser'],
  },

  // Don’t fail the app build on type/ESLint errors (Cloud Functions are typed separately)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  images: {
    remotePatterns: [
      // Firebase Storage (legacy)
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: '/v0/b/**' },
      // Firebase Storage (new per-bucket)
      { protocol: 'https', hostname: 'clean-kitchen-de925.firebasestorage.app', pathname: '/**' },
      // Google hosted avatars
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      // TheMealDB
      { protocol: 'https', hostname: 'www.themealdb.com', pathname: '/images/media/meals/**' },
      { protocol: 'https', hostname: 'themealdb.com', pathname: '/images/media/meals/**' },
      // OpenFoodFacts
      { protocol: 'https', hostname: 'images.openfoodfacts.org', pathname: '/**' },
      // Optional
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
    ],
  },
};

module.exports = nextConfig;
