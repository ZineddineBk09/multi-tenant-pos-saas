import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inventory Manager | POS SaaS",
  description: "Manage products and stock levels",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
