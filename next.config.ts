import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The pivot: Flights was retired for the Pro Shop (README, "Pivot: Flights → Pro Shop"). Old links land on the shop.
  async redirects() {
    return [{ source: "/clubhouse/flights", destination: "/clubhouse/shop", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
