import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore - Turbopack root config for monorepos
  turbopack: {
    root: "..",
  },
};

export default nextConfig;
