import Link from "next/link";
import { Footer, Navbar, SectionTitle, type Company } from "@/components/public";

async function getCompany(): Promise<Company> {
  try {
    const res = await fetch("/api/public/site", { cache: "no-store" });
    const j = await res.json();
    return { name: "GenISP", ...((j.ok && j.data?.company) || {}) };
  } catch {
    return { name: "GenISP" };
  }
}

export default async function SpeedtestPage() {
  const company = await getCompany();

  return (
    <div className="min-h-screen bg-white">
      <Navbar company={company} />
      <section className="pt-28 pb-16 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <SectionTitle
            eyebrow="Alat Bantu"
            title="Tes Kecepatan Internet"
            desc="Ukur kecepatan unduh, unggah, dan latensi koneksi Anda saat ini langsung dari browser."
          />
          <div className="card !p-2 overflow-hidden">
            <iframe
              src="https://openspeedtest.com/speedtest"
              title="Speedtest"
              className="w-full h-[70vh] min-h-[480px] rounded-xl border-0"
              allow="fullscreen"
              loading="lazy"
            />
          </div>
          <div className="mt-5 grid sm:grid-cols-3 gap-4 text-sm">
            <div className="card">
              <p className="font-bold text-slate-900 mb-1">Hasil tidak sesuai paket?</p>
              <p className="text-slate-500">Coba tes dengan kabel LAN dan tutup aplikasi lain agar hasilnya akurat.</p>
            </div>
            <div className="card">
              <p className="font-bold text-slate-900 mb-1">Butuh bantuan?</p>
              <p className="text-slate-500">
                Jika kecepatan jauh di bawah paket Anda, buat tiket bantuan agar teknisi kami memeriksa.
              </p>
            </div>
            <div className="card">
              <p className="font-bold text-slate-900 mb-1">Koneksi putus-putus?</p>
              <p className="text-slate-500">
                Pelanggan dapat mencoba <Link href="/portal" className="text-brand-600 font-semibold hover:underline">reset koneksi</Link> dari portal member.
              </p>
            </div>
          </div>
        </div>
      </section>
      <Footer company={company} />
    </div>
  );
}
