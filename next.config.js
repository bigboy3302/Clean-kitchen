/** @type {import('next').NextConfig} */

// Read and parse FIREBASE_WEBAPP_CONFIG if Firebase App Hosting provides it
function readFirebaseWebappConfig() {
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null; // don't crash build on bad JSON
  }
}

const fwcfg = readFirebaseWebappConfig();

// Build-time env injection for Next.js. Values here become process.env.* in your app.
const injectedEnv = fwcfg
  ? {
      NEXT_PUBLIC_FIREBASE_API_KEY: fwcfg.apiKey,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: fwcfg.authDomain,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: fwcfg.projectId,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: fwcfg.storageBucket,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: fwcfg.messagingSenderId,
      NEXT_PUBLIC_FIREBASE_APP_ID: fwcfg.appId,

      // keep any optional ones you rely on
      NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY || "",
      NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN: process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || "",
    }
  : {};

const nextConfig = {
  reactStrictMode: true,

  experimental: {
    // Helps trim bundle size for @zxing/browser
    optimizePackageImports: ["@zxing/browser"],
  },

  // Make the env available to the app during build/SSG/SSR
  env: injectedEnv,

  images: {
    remotePatterns: [
      // ExerciseDB GIF CDN
      { protocol: "https", hostname: "d205bpvrqc9yn1.cloudfront.net", pathname: "/**" },

      // Firebase Storage (legacy + per-bucket)
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/v0/b/**" },
      { protocol: "https", hostname: "clean-kitchen-de925.firebasestorage.app", pathname: "/**" },

      // Google hosted photos (profile images)
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },

      // TheMealDB images (recipes)
      { protocol: "https", hostname: "www.themealdb.com", pathname: "/images/media/meals/**" },
      { protocol: "https", hostname: "themealdb.com", pathname: "/images/media/meals/**" },

      // OpenFoodFacts product images (barcodes)
      { protocol: "https", hostname: "images.openfoodfacts.org", pathname: "/**" },

      // Optional common hosts
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
       { protocol: "https", hostname: "spoonacular.com", pathname: "/**" },
    { protocol: "https", hostname: "img.spoonacular.com", pathname: "/**" },
    ],
  },
};

module.exports = nextConfig;
