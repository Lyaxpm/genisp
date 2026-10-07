import Link from "next/link";
import { Footer, Navbar, SectionTitle, type Company, type Coverage } from "@/components/public";
import CoverageMap from "@/components/CoverageMap";

async function getSite(): Promise<{ company?: Company; coverages?: Coverage[] }> {
  try {
    const res = await fetch("/api/public/site", { cache: "no-store" });
    if (!res.ok) return {};
    const j = await res.json();
    return j.ok && j.data ? j.data : {};
  } catch {
    return {};
  }
}

export default async function PetaPage() {
  const site = await getSite();
  const company: Company = { name: "GenISP", ...(site.company ?? {}) };
  const coverages = site.coverages ?? [];

  return (
    <div className="min-h-screen bg-white">
      <Navbar company={company} />
      <section className="pt-28 pb-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionTitle
            eyebrow="Jangkauan"
            title="Peta Cakupan Wilayah"
            desc="Lihat area layanan kami di peta, lalu cek apakah lokasi Anda sudah tercover."
          />
          {coverages.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-slate-500 text-sm">Data cakupan belum tersedia. Silakan hubungi kami untuk menanyakan ketersediaan di wilayah Anda.</p>
              <Link href="/daftar" className="btn-primary mt-5">Hubungi Kami</Link>
            </div>
          ) : (
            <CoverageMap coverages={coverages} />
          )}
        </div>
      </section>
      <Footer company={company} />
    </div>
  );
}
