import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GenISP — Internet Cepat & Stabil",
    short_name: "GenISP",
    description: "Portal pelanggan GenISP: cek tagihan, bayar, beli voucher, dan kelola layanan internet Anda.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0d627c",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
