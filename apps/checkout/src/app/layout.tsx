import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Checkout Terminal | POS SaaS",
  description: "Point-of-sale checkout terminal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
