"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/admin";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="card">
      <div className="h-[65vh] min-h-[420px] rounded-xl bg-slate-100 animate-pulse flex items-center justify-center">
        <p className="text-sm text-slate-400">Memuat peta…</p>
      </div>
    </div>
  ),
});

export default function PetaPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Peta Jaringan"
        subtitle="Visualisasi ODC, ODP, pelanggan, jalur kabel fiber, dan area cakupan wilayah."
      />
      <MapView />
    </div>
  );
}
