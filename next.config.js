/** @type {import('next').NextConfig} */

// Read and parse FIREBASE_WEBAPP_CONFIG if Firebase App Hosting provides it
function readFirebaseWebappConfig() {
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Don't crash build if someone mis-sets it
    return null;
  }
}

const fwcfg = readFirebaseWebappConfig();

// Build-time env injection for Next.js. Values here become process.env.* in your app.
const injectedEnv = fwcfg
  ? {
      // Map hosting-provided JSON -> your existing NEXT_PUBLIC_* variables
      NEXT_PUBLIC_FIREBASE_API_KEY: fwcfg.apiKey,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: fwcfg.authDomain,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: fwcfg.projectId,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: fwcfg.storageBucket,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: fwcfg.messagingSenderId,
      NEXT_PUBLIC_FIREBASE_APP_ID: fwcfg.appId,

      // Keep any optional ones you already rely on (leave as-is or set in console)
      NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY || "",
      NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN: process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || "",
    }
  : {};

// Your existing config
const nextConfig = {
  reactStrictMode: true,

  // Helps trim bundle size for @zxing/browser
  experimental: {
    optimizePackageImports: ["@zxing/browser"],
  },

  // Make the env available to the app during build/SSG/SSR
  env: injectedEnv,

  images: {
    remotePatterns: [
      // Firebase Storage (legacy domain)
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/**",
      },
      // Firebase Storage (new per-bucket domain)
      {
        protocol: "https",
        hostname: "clean-kitchen-de925.firebasestorage.app",
        pathname: "/**",
      },
      // Google hosted photos (profile images, etc.)
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },

      // TheMealDB images (used by your recipes route)
      {
        protocol: "https",
        hostname: "www.themealdb.com",
        pathname: "/images/media/meals/**",
      },
      {
        protocol: "https",
        hostname: "themealdb.com",
        pathname: "/images/media/meals/**",
      },

      // OpenFoodFacts product images (for barcodes)
      {
        protocol: "https",
        hostname: "images.openfoodfacts.org",
        pathname: "/**",
      },

      // Optional common hosts
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

module.exports = nextConfig;
