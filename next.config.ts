import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The whole site runs in the browser, so it ships as plain static files (Netlify serves the `out/` folder).
  output: "export",
  images: { unoptimized: true },
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
