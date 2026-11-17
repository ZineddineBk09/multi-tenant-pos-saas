const raw = process.env.INVENTORY_URL || "https://posinventory-production-c8002ad4.up.railway.app";
const INVENTORY_URL = (/^https?:\/\//.test(raw) ? raw : `https://${raw}`).replace(/\/$/, "");

module.exports = {
  async rewrites() {
    return [
      { source: "/inventory", destination: `${INVENTORY_URL}/inventory` },
      { source: "/inventory/:path*", destination: `${INVENTORY_URL}/inventory/:path*` },
    ];
  },
};
