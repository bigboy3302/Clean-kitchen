/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // If you’re importing from @zxing/browser a lot, this can help trim bundle size a bit.
  experimental: {
    optimizePackageImports: ['@zxing/browser'],
  },

  images: {
    remotePatterns: [
      // Firebase Storage (legacy domain)
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/v0/b/**',
      },
      // Firebase Storage (new per-bucket domain)
      {
        protocol: 'https',
        hostname: 'clean-kitchen-de925.firebasestorage.app',
        pathname: '/**',
      },
      // Google hosted photos (profile images, etc.)
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },

      // TheMealDB images (used by your recipes route)
      {
        protocol: 'https',
        hostname: 'www.themealdb.com',
        pathname: '/images/media/meals/**',
      },
      {
        protocol: 'https',
        hostname: 'themealdb.com',
        pathname: '/images/media/meals/**',
      },

      // OpenFoodFacts product images (for barcodes)
      {
        protocol: 'https',
        hostname: 'images.openfoodfacts.org',
        pathname: '/**',
      },

      // Optional common hosts
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
