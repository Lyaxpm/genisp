import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GenISP — Billing & Network Automation",
  description: "Platform billing, pembayaran, dan otomasi jaringan untuk ISP. Cepat, bersih, tanpa license.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans">{children}</body>
    </html>
  );
}
