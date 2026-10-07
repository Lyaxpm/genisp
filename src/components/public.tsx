"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Tipe data + helper murni tinggal di @/lib/public-types agar aman diimpor
// oleh server component. Di sini diimpor untuk dipakai internal + di re-export
// supaya import lama dari "@/components/public" tetap jalan.
import {
  asInvoices,
  dateID,
  idr,
  invoiceTotal,
  periodLabel,
  type Company,
  type Coverage,
  type Customer,
  type Invoice,
  type PartnerInfo,
  type Pkg,
  type Promo,
  type Service,
  type Slide,
  type WalletTx,
} from "@/lib/public-types";

export {
  asInvoices,
  dateID,
  idr,
  invoiceTotal,
  periodLabel,
  type Company,
  type Coverage,
  type Customer,
  type Invoice,
  type PartnerInfo,
  type Pkg,
  type Promo,
  type Service,
  type Slide,
  type WalletTx,
};

/* ================= Helper khusus komponen ================= */

function statusMeta(status?: string): { text: string; cls: string } {
  const s = (status ?? "").toLowerCase();
  if (["paid", "lunas", "approved"].includes(s))
    return { text: "Lunas", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" };
  if (["unpaid", "belum bayar", "pending"].includes(s))
    return { text: s === "pending" ? "Menunggu" : "Belum Bayar", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" };
  if (["expired", "kedaluwarsa"].includes(s))
    return { text: "Kedaluwarsa", cls: "bg-slate-100 text-slate-600 ring-1 ring-slate-200" };
  if (["cancelled", "dibatalkan", "rejected", "ditolak"].includes(s))
    return { text: "Dibatalkan", cls: "bg-red-50 text-red-700 ring-1 ring-red-200" };
  if (["aktif", "active"].includes(s))
    return { text: "Aktif", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" };
  if (["isolir", "suspended"].includes(s))
    return { text: "Isolir", cls: "bg-red-50 text-red-700 ring-1 ring-red-200" };
  if (["nonaktif", "inactive"].includes(s))
    return { text: "Nonaktif", cls: "bg-slate-100 text-slate-600 ring-1 ring-slate-200" };
  return { text: status || "-", cls: "bg-slate-100 text-slate-600 ring-1 ring-slate-200" };
}

export function StatusBadge({ status }: { status?: string }) {
  const m = statusMeta(status);
  return <span className={`badge ${m.cls}`}>{m.text}</span>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 animate-fade-in">
      {msg}
    </div>
  );
}

function SuccessHero({ title, desc, href, hrefLabel }: { title: string; desc: string; href: string; hrefLabel: string }) {
  return (
    <div className="card max-w-lg mx-auto text-center py-12 animate-fade-up">
      <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-sm text-slate-500 mb-6">{desc}</p>
      <Link href={href} className="btn-primary">{hrefLabel}</Link>
    </div>
  );
}

/* ================= SectionTitle ================= */

export function SectionTitle({
  eyebrow,
  title,
  desc,
  center = true,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  center?: boolean;
}) {
  return (
    <div className={`${center ? "text-center mx-auto" : "text-left"} max-w-2xl mb-10`}>
      {eyebrow && (
        <span className="badge bg-brand-50 text-brand-600 ring-1 ring-brand-100 mb-3">{eyebrow}</span>
      )}
      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
      {desc && <p className="mt-3 text-slate-500">{desc}</p>}
    </div>
  );
}

/* ================= Navbar publik ================= */

const NAV_LINKS = [
  { href: "/#beranda", label: "Beranda" },
  { href: "/#paket", label: "Paket" },
  { href: "/#cakupan", label: "Cakupan" },
  { href: "/#promo", label: "Promo" },
  { href: "/#tentang", label: "Tentang" },
];

export function Navbar({ company }: { company: Company }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all ${
        scrolled ? "bg-white/90 backdrop-blur-md shadow-card border-b border-slate-100" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/#beranda" className="flex items-center gap-2.5">
            {company.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo_url} alt={company.name} className="w-9 h-9 rounded-xl object-cover" />
            ) : (
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white font-extrabold flex items-center justify-center text-lg shadow-soft">
                {company.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className={`font-extrabold tracking-tight text-lg ${scrolled ? "text-slate-900" : "text-white"}`}>
              {company.name}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition hover:bg-white/10 ${
                  scrolled ? "text-slate-600 hover:text-brand-600 hover:bg-brand-50" : "text-white/85 hover:text-white"
                }`}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <a
              href="/#cek-tagihan"
              className={scrolled ? "btn-outline" : "btn border border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur"}
            >
              Cek Tagihan
            </a>
            <Link href="/login" className="btn-primary">Masuk</Link>
          </div>

          <button
            className={`md:hidden p-2 rounded-lg ${scrolled ? "text-slate-700" : "text-white"}`}
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {open ? <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-slate-100 shadow-card animate-fade-in">
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-600">
                {l.label}
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              <a href="/#cek-tagihan" onClick={() => setOpen(false)} className="btn-outline flex-1">Cek Tagihan</a>
              <Link href="/login" className="btn-primary flex-1">Masuk</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/* ================= Footer publik ================= */

export function Footer({ company }: { company: Company }) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-brand-950 text-white/80 mt-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white font-extrabold flex items-center justify-center text-lg">
              {company.name.charAt(0).toUpperCase()}
            </span>
            <span className="font-extrabold text-lg text-white">{company.name}</span>
          </div>
          {company.tagline && <p className="text-sm text-white/60 mb-4">{company.tagline}</p>}
          {company.address && <p className="text-sm text-white/60">{company.address}</p>}
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Tautan</h4>
          <ul className="space-y-2.5 text-sm">
            {NAV_LINKS.map((l) => (
              <li key={l.href}><a href={l.href} className="hover:text-white transition">{l.label}</a></li>
            ))}
            <li><Link href="/daftar" className="hover:text-white transition">Daftar Berlangganan</Link></li>
            <li><Link href="/konfirmasi" className="hover:text-white transition">Konfirmasi Pembayaran</Link></li>
            <li><Link href="/login" className="hover:text-white transition">Masuk Portal</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Hubungi Kami</h4>
          <ul className="space-y-2.5 text-sm">
            {company.phone && <li>Telepon/WA: <span className="text-white">{company.phone}</span></li>}
            {company.email && <li>Email: <span className="text-white">{company.email}</span></li>}
            {company.website && <li>Website: <span className="text-white">{company.website}</span></li>}
            <li className="text-white/60">Jam layanan: Senin–Sabtu, 08.00–21.00 WIB</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-center text-xs text-white/50">
          © {year} {company.name}. Seluruh hak cipta dilindungi.
        </div>
      </div>
    </footer>
  );
}

/* ================= Widget Cek Tagihan ================= */

type BillResult = {
  customer: Customer | null;
  invoices: Invoice[];
};

export function CheckBillWidget() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BillResult | null>(null);
  const [searched, setSearched] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setError("");
    setResult(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/public/check-bill?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Gagal memeriksa tagihan.");
      const d = j.data ?? {};
      const customer = (d.customer ?? null) as Customer | null;
      const invoices = asInvoices(d).filter((i) => ["unpaid", "pending"].includes((i.status || "").toLowerCase()));
      if (!customer && invoices.length === 0) throw new Error("Data tidak ditemukan. Periksa kembali ID pelanggan atau nomor HP Anda.");
      setResult({ customer, invoices });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card shadow-soft max-w-2xl mx-auto">
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
        <input
          className="input flex-1"
          placeholder="Masukkan ID pelanggan atau nomor HP"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
          {loading ? "Memeriksa…" : "Cek Tagihan"}
        </button>
      </form>

      <div className="mt-4">
        <ErrorBox msg={error} />
        {result && (
          <div className="animate-fade-in rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            {result.customer && (
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <p className="font-bold text-slate-900">{result.customer.name}</p>
                  <p className="text-xs text-slate-500">
                    {result.customer.code ? `ID: ${result.customer.code} · ` : ""}{result.customer.phone ?? ""}
                  </p>
                </div>
                <StatusBadge status={result.customer.status} />
              </div>
            )}
            {result.invoices.length === 0 ? (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                Tidak ada tagihan yang belum dibayar. Terima kasih!
              </p>
            ) : (
              <ul className="space-y-2.5">
                {result.invoices.map((inv) => (
                  <li key={String(inv.id)} className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl border border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{inv.code}</p>
                      <p className="text-xs text-slate-500">
                        Periode {periodLabel(inv.period)} · Jatuh tempo {dateID(inv.due_date)}
                      </p>
                      <p className="text-sm font-bold text-brand-600 mt-0.5">{idr(invoiceTotal(inv))}</p>
                    </div>
                    <Link href={`/bayar/${encodeURIComponent(inv.code)}`} className="btn-primary !py-2">
                      Bayar
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!searched && !result && (
          <p className="text-xs text-slate-400 text-center mt-1">
            Cek dan bayar tagihan internet Anda tanpa perlu login.
          </p>
        )}
      </div>
    </div>
  );
}

/* ================= Form Pendaftaran ================= */

export function DaftarForm({ packages, defaultPaket }: { packages: Pkg[]; defaultPaket?: string }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    package_id: defaultPaket ?? "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          address: form.address.trim(),
          package_id: form.package_id || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Pendaftaran gagal. Coba lagi.");
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <SuccessHero
        title="Pendaftaran diterima!"
        desc="Terima kasih telah mendaftar. Tim kami akan segera menghubungi Anda untuk proses pemasangan."
        href="/"
        hrefLabel="Kembali ke Beranda"
      />
    );
  }

  const selected = packages.find((p) => String(p.id) === String(form.package_id));

  return (
    <form onSubmit={submit} className="card shadow-soft max-w-xl mx-auto space-y-4 animate-fade-up">
      <ErrorBox msg={error} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nama Lengkap *">
          <input className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nama Anda" />
        </Field>
        <Field label="No. HP / WhatsApp *">
          <input className="input" required value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="08xx…" inputMode="tel" />
        </Field>
      </div>
      <Field label="Email">
        <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@contoh.com" />
      </Field>
      <Field label="Alamat Pemasangan *">
        <textarea className="input min-h-[90px]" required value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Jalan, RT/RW, kelurahan, kecamatan, kota" />
      </Field>
      <Field label="Pilih Paket *">
        <select className="input" required value={form.package_id} onChange={(e) => set("package_id", e.target.value)}>
          <option value="">— Pilih paket internet —</option>
          {packages.map((p) => (
            <option key={String(p.id)} value={String(p.id)}>
              {p.name}{p.speed_down ? ` · ${p.speed_down}` : ""} · {idr(p.price)}/bln
            </option>
          ))}
        </select>
      </Field>
      {selected && (
        <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 text-sm text-brand-700 animate-fade-in">
          <span className="font-semibold">{selected.name}</span>
          {selected.speed_down && <span> · {selected.speed_down}</span>}
          {selected.description && <span className="block text-brand-600/80 mt-0.5">{selected.description}</span>}
          <span className="block font-bold mt-1">{idr(selected.price)}/bulan</span>
        </div>
      )}
      <Field label="Catatan (opsional)">
        <textarea className="input min-h-[70px]" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Contoh: preferensi jadwal survei…" />
      </Field>
      <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
        {loading ? "Mengirim…" : "Kirim Pendaftaran"}
      </button>
      <p className="text-xs text-slate-400 text-center">Data Anda aman dan hanya digunakan untuk proses berlangganan.</p>
    </form>
  );
}

/* ================= Form Konfirmasi Pembayaran ================= */

export function KonfirmasiForm({ defaultCode }: { defaultCode?: string }) {
  const [form, setForm] = useState({
    code: defaultCode ?? "",
    sender_name: "",
    amount: "",
    proof_url: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/public/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim(),
          sender_name: form.sender_name.trim(),
          amount: Number(form.amount) || undefined,
          proof_url: form.proof_url.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Konfirmasi gagal. Coba lagi.");
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <SuccessHero
        title="Konfirmasi terkirim!"
        desc="Bukti pembayaran Anda sudah kami terima dan akan diverifikasi oleh tim kami. Status tagihan akan diperbarui setelah verifikasi."
        href="/"
        hrefLabel="Kembali ke Beranda"
      />
    );
  }

  return (
    <form onSubmit={submit} className="card shadow-soft max-w-xl mx-auto space-y-4 animate-fade-up">
      <ErrorBox msg={error} />
      <Field label="Kode Invoice *">
        <input className="input font-mono" required value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="INV/2026/10/0001" />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nama Pengirim *">
          <input className="input" required value={form.sender_name} onChange={(e) => set("sender_name", e.target.value)} placeholder="Nama sesuai rekening" />
        </Field>
        <Field label="Nominal Transfer (Rp) *">
          <input className="input" required inputMode="numeric" value={form.amount} onChange={(e) => set("amount", e.target.value.replace(/[^0-9]/g, ""))} placeholder="150000" />
        </Field>
      </div>
      <Field label="URL Bukti Transfer">
        <input className="input" type="url" value={form.proof_url} onChange={(e) => set("proof_url", e.target.value)} placeholder="https://… (link foto/screenshot bukti)" />
        <p className="text-xs text-slate-400 mt-1">Unggah screenshot bukti ke layanan hosting gambar, lalu tempel link-nya di sini.</p>
      </Field>
      <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
        {loading ? "Mengirim…" : "Kirim Konfirmasi"}
      </button>
    </form>
  );
}

/* ================= Panel Bayar (publik & portal) ================= */

type CheckoutResult = {
  payment_url?: string;
  checkout_url?: string;
  qr_url?: string;
  qr_string?: string;
  instructions?: string[] | string;
  expired_at?: string;
  amount?: number | string;
  [k: string]: unknown;
};

export function BayarPanel({
  invoice,
  waNumber,
  confirmBase = "/konfirmasi",
}: {
  invoice: Invoice;
  waNumber?: string;
  confirmBase?: string;
}) {
  const [method, setMethod] = useState<"manual" | "gateway">("manual");
  const [gateway, setGateway] = useState("xendit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);

  const total = invoiceTotal(invoice);
  const waHref = waNumber
    ? `https://wa.me/${waNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Halo, saya ingin konfirmasi pembayaran invoice ${invoice.code} sebesar ${idr(total)}`)}`
    : undefined;

  async function checkout() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoice.id, gateway }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Gagal membuat pembayaran.");
      setResult((j.data ?? {}) as CheckoutResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  const payUrl = result?.payment_url || result?.checkout_url;
  const instructions = result?.instructions
    ? Array.isArray(result.instructions) ? result.instructions : [result.instructions]
    : [];

  return (
    <div className="card shadow-soft animate-fade-up">
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 mb-5">
        {(["manual", "gateway"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              method === m ? "bg-white shadow-card text-brand-600" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {m === "manual" ? "Transfer Manual" : "Payment Gateway"}
          </button>
        ))}
      </div>

      {method === "manual" ? (
        <div className="space-y-4 animate-fade-in">
          <ol className="space-y-3 text-sm text-slate-600">
            {[
              `Transfer tepat sebesar ${idr(total)} ke rekening resmi perusahaan.`,
              "Jika ada kode unik, pastikan nominal sama persis agar terverifikasi otomatis.",
              "Simpan bukti transfer, lalu klik tombol di bawah untuk konfirmasi.",
            ].map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link href={`${confirmBase}?code=${encodeURIComponent(invoice.code)}`} className="btn-primary flex-1 !py-3">
              Saya Sudah Bayar
            </Link>
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer" className="btn-outline flex-1 !py-3">
                Hubungi CS via WhatsApp
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          <Field label="Pilih Gateway">
            <select className="input" value={gateway} onChange={(e) => setGateway(e.target.value)}>
              <option value="xendit">Xendit (VA, QRIS, E-Wallet)</option>
              <option value="midtrans">Midtrans</option>
              <option value="tripay">Tripay</option>
              <option value="duitku">Duitku</option>
              <option value="doku">Doku (Alfamart/Indomaret)</option>
              <option value="ipaymu">iPaymu</option>
              <option value="bni">BNI Virtual Account</option>
              <option value="moota">Transfer Bank (verifikasi otomatis)</option>
            </select>
          </Field>
          <ErrorBox msg={error} />
          {!result ? (
            <button onClick={checkout} disabled={loading} className="btn-primary w-full !py-3">
              {loading ? "Memproses…" : `Bayar ${idr(total)}`}
            </button>
          ) : (
            <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4 space-y-3 animate-fade-in">
              {result.qr_url || result.qr_string ? (
                <div className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={String(result.qr_url ?? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(String(result.qr_string))}`)}
                    alt="QR Pembayaran"
                    className="w-52 h-52 mx-auto rounded-xl bg-white p-2 shadow-card"
                  />
                  <p className="text-xs text-slate-500 mt-2">Pindai QR di atas dengan aplikasi pembayaran Anda</p>
                </div>
              ) : null}
              {payUrl ? (
                <a href={String(payUrl)} target="_blank" rel="noreferrer" className="btn-primary w-full !py-3">
                  Buka Halaman Pembayaran
                </a>
              ) : null}
              {instructions.length > 0 && (
                <ul className="text-sm text-slate-600 space-y-1.5 bg-white rounded-xl border border-slate-100 p-4">
                  {instructions.map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              )}
              {result.expired_at && (
                <p className="text-xs text-amber-700 text-center">Berlaku hingga {dateID(String(result.expired_at))}</p>
              )}
              {!payUrl && !result.qr_url && !result.qr_string && instructions.length === 0 && (
                <p className="text-sm text-slate-600">Pembayaran dibuat. Ikuti instruksi dari penyedia pembayaran untuk menyelesaikan transaksi.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= Shell halaman publik (non-landing) ================= */

export function PublicShell({
  company,
  eyebrow,
  title,
  desc,
  children,
}: {
  company: Company;
  eyebrow?: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white font-extrabold flex items-center justify-center text-lg shadow-soft">
              {company.name.charAt(0).toUpperCase()}
            </span>
            <span className="font-extrabold tracking-tight text-lg text-slate-900">{company.name}</span>
          </Link>
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-brand-600 transition">
            ← Beranda
          </Link>
        </div>
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center max-w-xl mx-auto mb-8 animate-fade-up">
          {eyebrow && <span className="badge bg-brand-50 text-brand-600 ring-1 ring-brand-100 mb-3">{eyebrow}</span>}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
          {desc && <p className="mt-2.5 text-slate-500 text-sm sm:text-base">{desc}</p>}
        </div>
        {children}
      </main>
      <Footer company={company} />
    </div>
  );
}

/* ================= Login ================= */

const LOGIN_TABS = [
  { key: "staff", label: "Staff", redirect: "/dashboard" },
  { key: "member", label: "Member", redirect: "/portal" },
  { key: "partner", label: "Partner", redirect: "/partner" },
] as const;

export function LoginForm({ next }: { next?: string }) {
  const [tab, setTab] = useState<(typeof LOGIN_TABS)[number]["key"]>("member");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const active = LOGIN_TABS.find((t) => t.key === tab)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, as: tab }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Login gagal. Periksa kembali data Anda.");
      const kind = (j.data?.kind as string) || tab;
      const fallback =
        kind === "staff" ? "/dashboard" : kind === "partner" ? "/partner" : "/portal";
      window.location.href = next || fallback;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card shadow-soft w-full max-w-md mx-auto animate-fade-up">
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 mb-6">
        {LOGIN_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setError(""); }}
            className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
              tab === t.key ? "bg-white shadow-card text-brand-600" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <h1 className="text-xl font-extrabold text-slate-900 mb-1">Masuk sebagai {active.label}</h1>
      <p className="text-sm text-slate-500 mb-5">
        {tab === "member"
          ? "Akses portal pelanggan untuk cek tagihan & layanan."
          : tab === "partner"
          ? "Kelola pelanggan dan pantau komisi Anda."
          : "Masuk ke dashboard operasional ISP."}
      </p>

      <form onSubmit={submit} className="space-y-4">
        <ErrorBox msg={error} />
        <Field label={tab === "member" ? "Email atau No. HP" : "Email"}>
          <input
            className="input"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={tab === "member" ? "email@contoh.com / 08xx…" : "email@perusahaan.com"}
            autoComplete="username"
          />
        </Field>
        <Field label="Kata Sandi">
          <input
            className="input"
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>
        <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
          {loading ? "Memeriksa…" : `Masuk sebagai ${active.label}`}
        </button>
      </form>

      {tab === "member" && (
        <p className="text-xs text-slate-400 text-center mt-4">
          Belum berlangganan? <Link href="/daftar" className="text-brand-600 font-semibold hover:underline">Daftar di sini</Link>
        </p>
      )}
    </div>
  );
}

/* ================= Portal: navigasi & logout ================= */

const PORTAL_LINKS = [
  { href: "/portal", label: "Dashboard", exact: true },
  { href: "/portal/tagihan", label: "Tagihan", exact: false },
  { href: "/portal/wallet", label: "Wallet", exact: false },
  { href: "/portal/tiket", label: "Tiket Bantuan", exact: false },
  { href: "/portal/profil", label: "Profil", exact: false },
];

export function PortalNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 -mb-1">
      {PORTAL_LINKS.map((l) => {
        const active = l.exact ? path === l.href : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
              active ? "bg-brand-500 text-white shadow-soft" : "text-slate-500 hover:text-brand-600 hover:bg-brand-50"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* abaikan, tetap redirect */
    } finally {
      window.location.href = "/login";
    }
  }
  return (
    <button onClick={logout} disabled={loading} className="btn-outline !py-2 text-sm">
      {loading ? "…" : "Keluar"}
    </button>
  );
}

/* ================= Portal: form profil ================= */

export function ProfilForm({ customer }: { customer: Customer }) {
  const [profile, setProfile] = useState({
    name: customer.name ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    address: customer.address ?? "",
  });
  const [pass, setPass] = useState({ current_password: "", new_password: "", confirm: "" });
  const [msg, setMsg] = useState({ ok: "", err: "" });
  const [passMsg, setPassMsg] = useState({ ok: "", err: "" });
  const [loading, setLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  function setP<K extends keyof typeof profile>(k: K, v: string) {
    setProfile((f) => ({ ...f, [k]: v }));
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg({ ok: "", err: "" });
    try {
      const res = await fetch("/api/portal/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name.trim(),
          email: profile.email.trim() || undefined,
          phone: profile.phone.trim(),
          address: profile.address.trim(),
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Gagal menyimpan profil.");
      setMsg({ ok: "Profil berhasil diperbarui.", err: "" });
    } catch (err: unknown) {
      setMsg({ ok: "", err: err instanceof Error ? err.message : "Terjadi kesalahan." });
    } finally {
      setLoading(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassMsg({ ok: "", err: "" });
    if (pass.new_password.length < 6) {
      setPassMsg({ ok: "", err: "Kata sandi baru minimal 6 karakter." });
      return;
    }
    if (pass.new_password !== pass.confirm) {
      setPassMsg({ ok: "", err: "Konfirmasi kata sandi tidak cocok." });
      return;
    }
    setPassLoading(true);
    try {
      const res = await fetch("/api/portal/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: pass.current_password,
          new_password: pass.new_password,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Gagal mengubah kata sandi.");
      setPassMsg({ ok: "Kata sandi berhasil diubah.", err: "" });
      setPass({ current_password: "", new_password: "", confirm: "" });
    } catch (err: unknown) {
      setPassMsg({ ok: "", err: err instanceof Error ? err.message : "Terjadi kesalahan." });
    } finally {
      setPassLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={saveProfile} className="card space-y-4">
        <h2 className="font-bold text-slate-900">Ubah Profil</h2>
        {msg.err && <ErrorBox msg={msg.err} />}
        {msg.ok && <p className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 animate-fade-in">{msg.ok}</p>}
        <Field label="Nama Lengkap">
          <input className="input" value={profile.name} onChange={(e) => setP("name", e.target.value)} required />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Email">
            <input className="input" type="email" value={profile.email} onChange={(e) => setP("email", e.target.value)} />
          </Field>
          <Field label="No. HP">
            <input className="input" value={profile.phone} onChange={(e) => setP("phone", e.target.value)} required />
          </Field>
        </div>
        <Field label="Alamat">
          <textarea className="input min-h-[80px]" value={profile.address} onChange={(e) => setP("address", e.target.value)} />
        </Field>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Menyimpan…" : "Simpan Profil"}
        </button>
      </form>

      <form onSubmit={savePassword} className="card space-y-4 h-fit">
        <h2 className="font-bold text-slate-900">Ubah Kata Sandi</h2>
        {passMsg.err && <ErrorBox msg={passMsg.err} />}
        {passMsg.ok && <p className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 animate-fade-in">{passMsg.ok}</p>}
        <Field label="Kata Sandi Saat Ini">
          <input className="input" type="password" value={pass.current_password} onChange={(e) => setPass({ ...pass, current_password: e.target.value })} required autoComplete="current-password" />
        </Field>
        <Field label="Kata Sandi Baru">
          <input className="input" type="password" value={pass.new_password} onChange={(e) => setPass({ ...pass, new_password: e.target.value })} required autoComplete="new-password" />
        </Field>
        <Field label="Konfirmasi Kata Sandi Baru">
          <input className="input" type="password" value={pass.confirm} onChange={(e) => setPass({ ...pass, confirm: e.target.value })} required autoComplete="new-password" />
        </Field>
        <button type="submit" disabled={passLoading} className="btn-primary w-full">
          {passLoading ? "Menyimpan…" : "Ubah Kata Sandi"}
        </button>
      </form>
    </div>
  );
}
