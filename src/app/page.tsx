import Link from "next/link";
import {
  CheckBillWidget,
  Footer,
  Navbar,
  SectionTitle,
  idr,
  dateID,
  type Company,
  type Coverage,
  type Pkg,
  type Promo,
  type Service,
} from "@/components/public";

type SiteData = {
  company?: Company;
  slides?: { title?: string; subtitle?: string; image_url?: string; link_url?: string }[];
  promos?: Promo[];
  services?: Service[];
  packages?: Pkg[];
  coverages?: Coverage[];
};

async function getSite(): Promise<SiteData> {
  try {
    const res = await fetch("/api/public/site", { cache: "no-store" });
    if (!res.ok) return {};
    const j = await res.json();
    return j.ok && j.data ? (j.data as SiteData) : {};
  } catch {
    return {};
  }
}

const DEFAULT_COMPANY: Company = {
  name: "GenISP",
  tagline: "Internet cepat, stabil, dan terjangkau untuk rumah & bisnis Anda.",
};

export default async function LandingPage() {
  const site = await getSite();
  const company: Company = { ...DEFAULT_COMPANY, ...(site.company ?? {}) };
  const packages = site.packages ?? [];
  const services = site.services ?? [];
  const promos = site.promos ?? [];
  const coverages = site.coverages ?? [];

  return (
    <div className="min-h-screen bg-white">
      <Navbar company={company} />

      {/* ============ HERO ============ */}
      <section id="beranda" className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500">
        {/* dekorasi */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl animate-float-soft" />
          <div className="absolute top-1/2 -left-32 w-[28rem] h-[28rem] rounded-full bg-brand-300/20 blur-3xl animate-float-slower" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-32 pb-20 md:pt-40 md:pb-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-up">
              <span className="badge bg-white/15 text-white ring-1 ring-white/25 mb-5">
                Layanan Internet Fiber Optik
              </span>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
                Internet Cepat & Stabil untuk Semua Kebutuhan
              </h1>
              <p className="mt-5 text-lg text-white/75 max-w-lg">
                {company.tagline}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/daftar" className="btn bg-white text-brand-700 hover:bg-brand-50 font-bold !px-7 !py-3 shadow-soft">
                  Daftar Sekarang
                </Link>
                <a href="#cek-tagihan" className="btn border border-white/40 text-white hover:bg-white/10 !px-7 !py-3 font-semibold">
                  Cek Tagihan
                </a>
              </div>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <Link href="/peta" className="text-white/70 hover:text-white underline underline-offset-4 decoration-white/30 transition">Peta Cakupan</Link>
                <Link href="/voucher" className="text-white/70 hover:text-white underline underline-offset-4 decoration-white/30 transition">Beli Voucher</Link>
                <Link href="/speedtest" className="text-white/70 hover:text-white underline underline-offset-4 decoration-white/30 transition">Speedtest</Link>
                <Link href="/bantuan" className="text-white/70 hover:text-white underline underline-offset-4 decoration-white/30 transition">Bantuan</Link>
              </div>
              <div className="mt-10 flex gap-8">
                {[
                  { n: `${packages.length || "10"}+`, l: "Pilihan Paket" },
                  { n: "99%", l: "Uptime Jaringan" },
                  { n: "24/7", l: "Dukungan Teknis" },
                ].map((s) => (
                  <div key={s.l}>
                    <p className="text-2xl font-extrabold text-white">{s.n}</p>
                    <p className="text-xs text-white/60 mt-0.5">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* kartu dekoratif */}
            <div className="relative hidden md:block animate-fade-up" style={{ animationDelay: "150ms" }}>
              <div className="card !p-0 overflow-hidden shadow-soft rotate-2">
                <div className="bg-gradient-to-br from-brand-700 to-brand-500 p-8 text-white">
                  <p className="text-xs uppercase tracking-widest text-white/60 mb-2">Kecepatan hingga</p>
                  <p className="text-5xl font-extrabold">100<span className="text-2xl font-bold text-white/70"> Mbps</span></p>
                  <div className="mt-6 space-y-2.5">
                    {["Streaming 4K tanpa buffering", "Game online ping rendah", "WFA & meeting lancar"].map((t) => (
                      <div key={t} className="flex items-center gap-2.5 text-sm text-white/85">
                        <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">✓</span>
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Mulai dari</p>
                    <p className="text-xl font-extrabold text-brand-600">{packages[0] ? idr(packages[0].price) : "Rp 150.000"}<span className="text-xs font-medium text-slate-400">/bln</span></p>
                  </div>
                  <Link href="/daftar" className="btn-primary">Pilih Paket</Link>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-6 card !py-3 !px-4 flex items-center gap-3 -rotate-3 animate-float-soft shadow-soft">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs font-semibold text-slate-700">Jaringan terpantau 24 jam</p>
              </div>
            </div>
          </div>
        </div>

        <svg className="relative block w-full text-white" viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden>
          <path fill="currentColor" d="M0,40 C360,80 1080,0 1440,40 L1440,70 L0,70 Z" />
        </svg>
      </section>

      {/* ============ CEK TAGIHAN ============ */}
      <section id="cek-tagihan" className="py-16 sm:py-20 bg-white scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionTitle
            eyebrow="Layanan Mandiri"
            title="Cek & Bayar Tagihan"
            desc="Masukkan ID pelanggan atau nomor HP Anda untuk melihat tagihan yang belum dibayar — tanpa perlu login."
          />
          <CheckBillWidget />
        </div>
      </section>

      {/* ============ PAKET ============ */}
      <section id="paket" className="py-16 sm:py-24 bg-slate-50 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <SectionTitle
            eyebrow="Harga Transparan"
            title="Pilih Paket Internet Anda"
            desc="Semua paket unlimited tanpa batas kuota. Harga sudah termasuk PPN dan sewa perangkat."
          />
          {packages.length === 0 ? (
            <p className="text-center text-slate-400 text-sm">Daftar paket segera hadir. Hubungi kami untuk info terbaru.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.map((p, i) => (
                <div
                  key={String(p.id)}
                  className="card flex flex-col hover:shadow-soft hover:-translate-y-1 transition-all duration-300 animate-fade-up"
                  style={{ animationDelay: `${(i % 3) * 90}ms` }}
                >
                  {p.category && (
                    <span className="badge bg-brand-50 text-brand-600 ring-1 ring-brand-100 self-start mb-3 capitalize">
                      {p.category}
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
                  {(p.speed_down || p.speed_up) && (
                    <p className="mt-1 text-2xl font-extrabold text-brand-600">
                      {p.speed_down ?? p.speed_up}
                      {p.speed_up && p.speed_down && <span className="text-sm font-semibold text-slate-400"> / {p.speed_up} up</span>}
                    </p>
                  )}
                  {p.description && <p className="mt-2 text-sm text-slate-500 flex-1">{p.description}</p>}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-slate-400">per bulan</p>
                      <p className="text-xl font-extrabold text-slate-900">{idr(p.price)}</p>
                    </div>
                    <Link href={`/daftar?paket=${p.id}`} className="btn-primary">Pilih</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============ LAYANAN ============ */}
      {services.length > 0 && (
        <section id="layanan" className="py-16 sm:py-24 bg-white scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionTitle
              eyebrow="Kenapa Kami"
              title="Layanan Unggulan"
              desc="Komitmen kami: koneksi yang bisa diandalkan dan dukungan yang sigap."
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {services.map((s, i) => (
                <div key={String(s.id)} className="card text-center hover:shadow-soft transition-shadow animate-fade-up" style={{ animationDelay: `${(i % 4) * 80}ms` }}>
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white text-xl flex items-center justify-center mb-4 shadow-soft">
                    {s.icon || "✦"}
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1.5">{s.title}</h3>
                  {s.description && <p className="text-sm text-slate-500">{s.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ PROMO ============ */}
      {promos.length > 0 && (
        <section id="promo" className="py-16 sm:py-24 bg-gradient-to-b from-brand-50/60 to-white scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionTitle
              eyebrow="Penawaran Spesial"
              title="Promo Bulan Ini"
              desc="Jangan lewatkan penawaran menarik untuk pelanggan baru maupun setia."
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {promos.map((pr, i) => (
                <div key={String(pr.id)} className="card !p-0 overflow-hidden hover:shadow-soft transition-shadow animate-fade-up" style={{ animationDelay: `${(i % 3) * 90}ms` }}>
                  {pr.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pr.image_url} alt={pr.title} className="w-full h-44 object-cover" />
                  )}
                  <div className="p-5">
                    <h3 className="font-bold text-slate-900 mb-1.5">{pr.title}</h3>
                    {pr.description && <p className="text-sm text-slate-500 mb-3">{pr.description}</p>}
                    {pr.valid_until && (
                      <span className="badge bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                        Berlaku s/d {dateID(pr.valid_until)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ CAKUPAN ============ */}
      <section id="cakupan" className="py-16 sm:py-24 bg-white scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-10 items-start">
            <div>
              <SectionTitle
                center={false}
                eyebrow="Jangkauan"
                title="Cakupan Wilayah Layanan"
                desc="Jaringan fiber optik kami terus berkembang. Berikut wilayah yang sudah tercover — dan akan terus bertambah."
              />
              <Link href="/daftar" className="btn-primary">Cek Ketersediaan di Lokasi Anda</Link>
            </div>
            <div className="space-y-3">
              {coverages.length === 0 ? (
                <p className="text-sm text-slate-400">Data cakupan segera diperbarui. Silakan hubungi kami untuk menanyakan ketersediaan di wilayah Anda.</p>
              ) : (
                coverages.map((c, i) => (
                  <div key={String(c.id)} className="card !py-4 flex gap-3.5 items-start animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
                    <span className="mt-0.5 w-8 h-8 shrink-0 rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7-7.5 11.25-7.5 11.25S4.5 17.5 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{c.name}</p>
                      {c.description && <p className="text-sm text-slate-500 mt-0.5">{c.description}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ TENTANG ============ */}
      <section id="tentang" className="py-16 sm:py-24 bg-slate-50 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="card shadow-soft !p-8 sm:!p-12 grid md:grid-cols-2 gap-10">
            <div>
              <SectionTitle center={false} eyebrow="Tentang Kami" title={company.name} />
              {company.tagline && <p className="text-slate-600 -mt-6 mb-6">{company.tagline}</p>}
              <p className="text-sm text-slate-500 leading-relaxed">
                {company.name} adalah penyedia layanan internet yang berfokus pada kualitas koneksi
                dan kepuasan pelanggan. Dengan infrastruktur fiber optik modern dan tim teknis yang
                siaga, kami memastikan Anda selalu terhubung — untuk bekerja, belajar, dan hiburan.
              </p>
            </div>
            <div className="space-y-4 text-sm">
              {company.address && (
                <div className="flex gap-3">
                  <span className="font-semibold text-slate-700 w-24 shrink-0">Alamat</span>
                  <span className="text-slate-500">{company.address}</span>
                </div>
              )}
              {company.phone && (
                <div className="flex gap-3">
                  <span className="font-semibold text-slate-700 w-24 shrink-0">Telepon</span>
                  <span className="text-slate-500">{company.phone}</span>
                </div>
              )}
              {company.email && (
                <div className="flex gap-3">
                  <span className="font-semibold text-slate-700 w-24 shrink-0">Email</span>
                  <span className="text-slate-500">{company.email}</span>
                </div>
              )}
              {company.website && (
                <div className="flex gap-3">
                  <span className="font-semibold text-slate-700 w-24 shrink-0">Website</span>
                  <span className="text-slate-500">{company.website}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ VOUCHER ============ */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="card shadow-soft !p-8 sm:!p-10 flex flex-col md:flex-row md:items-center gap-6 justify-between bg-gradient-to-br from-brand-50/70 to-white">
            <div>
              <span className="badge bg-brand-50 text-brand-600 ring-1 ring-brand-100 mb-3">Tanpa Berlangganan</span>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Butuh Internet Dadakan?</h2>
              <p className="mt-2 text-slate-500 text-sm max-w-lg">
                Beli voucher hotspot untuk akses internet cepat per jam/harian — tanpa daftar, tanpa login, langsung dapat kode.
              </p>
            </div>
            <Link href="/voucher" className="btn-primary shrink-0 !px-7 !py-3">Beli Voucher</Link>
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-brand-700 to-brand-500 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Siap beralih ke internet yang lebih cepat?</h2>
          <p className="mt-3 text-white/75">Pendaftaran online, survei gratis, pemasangan cepat oleh teknisi profesional.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/daftar" className="btn bg-white text-brand-700 hover:bg-brand-50 font-bold !px-8 !py-3">Daftar Sekarang</Link>
            <Link href="/login" className="btn border border-white/40 text-white hover:bg-white/10 !px-8 !py-3 font-semibold">Masuk Portal</Link>
          </div>
        </div>
      </section>

      <Footer company={company} />
    </div>
  );
}
