import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/inventory",
  transpilePackages: ["@pos/ui", "@pos/api-client"],
};

export default nextConfig;
