/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
      remotePatterns: [
        // Firebase storage + Google hosted photos
        { protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: '/v0/b/**' },
        { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
  
        // TheMealDB (your API images)
        { protocol: 'https', hostname: 'www.themealdb.com', pathname: '/images/media/meals/**' },
        { protocol: 'https', hostname: 'themealdb.com', pathname: '/images/media/meals/**' },
  
        // Optional common hosts
        { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      ],
    },
  };
  
  module.exports = nextConfig;
  