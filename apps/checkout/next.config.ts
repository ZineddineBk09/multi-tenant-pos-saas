import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/checkout",
  transpilePackages: ["@pos/ui", "@pos/api-client"],
};

export default nextConfig;
