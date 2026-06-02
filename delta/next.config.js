// const withPWA = require("@ducanh2912/next-pwa").default;

const nextConfig = {
  reactStrictMode: true,
};


export default nextConfig
// module.exports = withPWA({
//   dest: "public",               // sw.js + workbox files land in /public
//   cacheOnFrontEndNav: true,     // cache pages visited during SPA navigation
//   aggressiveFrontEndNavCaching: true,
//   reloadOnOnline: true,         // reload stale offline page when back online
//   disable: process.env.NODE_ENV === "development", // no SW in dev
//   workboxOptions: {
//     disableDevLogs: true,
//     runtimeCaching: [
//       // Cache API responses for up to 60 s (stale-while-revalidate)
//       {
//         urlPattern: /^https:\/\/.*\/api\/.*/i,
//         handler: "NetworkFirst",
//         options: {
//           cacheName: "carlton-api-cache",
//           expiration: { maxEntries: 100, maxAgeSeconds: 60 },
//           networkTimeoutSeconds: 10,
//         },
//       },
//       // Cache static assets aggressively
//       {
//         urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/i,
//         handler: "CacheFirst",
//         options: {
//           cacheName: "carlton-static-assets",
//           expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
//         },
//       },
//     ],
//   },
// })(nextConfig);
