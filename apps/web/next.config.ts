import type { NextConfig } from "next";

const inventoryUrl = process.env.INVENTORY_URL ?? "http://localhost:3001";
const checkoutUrl = process.env.CHECKOUT_URL ?? "http://localhost:3002";

const nextConfig: NextConfig = {
  transpilePackages: ["@pos/ui", "@pos/api-client"],
  async rewrites() {
    return [
      {
        source: "/inventory",
        destination: `${inventoryUrl}/inventory`,
      },
      {
        source: "/inventory/:path*",
        destination: `${inventoryUrl}/inventory/:path*`,
      },
      {
        source: "/checkout",
        destination: `${checkoutUrl}/checkout`,
      },
      {
        source: "/checkout/:path*",
        destination: `${checkoutUrl}/checkout/:path*`,
      },
    ];
  },
};

export default nextConfig;
