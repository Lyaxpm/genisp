"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { idr } from "@/lib/public-types";

type VoucherPkg = {
  id: number;
  name: string;
  price: number | string;
  duration_hours: number;
  description?: string | null;
};

type Bought = {
  voucher: { code: string; package_name: string; price: number | string; duration_hours: number };
  payment_instruction: string;
};

function fmtDur(hours: number): string {
  if (hours >= 24 && hours % 24 === 0) {
    const d = hours / 24;
    return `${d} hari`;
  }
  return `${hours} jam`;
}

export default function VoucherPage() {
  const [pkgs, setPkgs] = useState<VoucherPkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VoucherPkg | null>(null);
  const [buyer, setBuyer] = useState({ name: "", phone: "" });
  const [buying, setBuying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bought, setBought] = useState<Bought | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<{ packages: VoucherPkg[] }>("/api/public/voucher-packages")
      .then((d) => setPkgs(d.packages ?? []))
      .catch((e) => setErr(e instanceof Error ? e.message : "Gagal memuat paket"))
      .finally(() => setLoading(false));
  }, []);

  async function buy() {
    if (!selected) return;
    setBuying(true);
    setErr(null);
    try {
      const d = await api<Bought>("/api/public/voucher-buy", {
        method: "POST",
        body: JSON.stringify({
          package_id: selected.id,
          buyer_name: buyer.name.trim(),
          buyer_phone: buyer.phone.trim(),
        }),
      });
      setBought(d);
      setSelected(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal membuat voucher");
    } finally {
      setBuying(false);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <span className="badge bg-brand-50 text-brand-600 ring-1 ring-brand-100 mb-3">Hotspot</span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Beli Voucher Internet</h1>
          <p className="text-slate-500 mt-2 text-sm max-w-lg mx-auto">
            Butuh internet cepat tanpa berlangganan? Pilih paket voucher, bayar, langsung dapat kode — tanpa login.
          </p>
        </div>

        {loading && <p className="text-center text-sm text-slate-400 py-10">Memuat paket voucher…</p>}
        {err && !bought && <p className="card text-sm text-red-600 bg-red-50 text-center">{err}</p>}

        {/* sukses */}
        {bought && (
          <div className="card text-center shadow-soft animate-fade-up">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 flex items-center justify-center text-2xl mb-4">
              ✓
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">Voucher Berhasil Dibuat!</h2>
            <p className="text-sm text-slate-500 mt-1">{bought.voucher.package_name} · {fmtDur(Number(bought.voucher.duration_hours))}</p>
            <div className="mt-6 inline-block bg-slate-900 text-white rounded-2xl px-10 py-6">
              <p className="text-xs uppercase tracking-widest text-white/50 mb-1">Kode Voucher</p>
              <p className="text-4xl font-mono font-extrabold tracking-[0.2em]">{bought.voucher.code}</p>
            </div>
            <div className="mt-4">
              <button className="btn-outline" onClick={() => copyCode(bought.voucher.code)}>
                {copied ? "✓ Tersalin!" : "Salin Kode"}
              </button>
            </div>
            <div className="mt-6 text-left bg-amber-50 ring-1 ring-amber-200 rounded-2xl p-5">
              <p className="font-bold text-amber-800 text-sm mb-1.5">Langkah pembayaran</p>
              <p className="text-sm text-amber-800/80 leading-relaxed">{bought.payment_instruction}</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button className="btn-outline" onClick={() => setBought(null)}>Beli Lagi</button>
              <Link href="/" className="btn-primary">Kembali ke Beranda</Link>
            </div>
          </div>
        )}

        {/* daftar paket */}
        {!bought && !loading && pkgs.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-5">
            {pkgs.map((p) => (
              <div key={p.id} className="card flex flex-col hover:shadow-soft transition-shadow">
                <h3 className="font-bold text-slate-900 text-lg">{p.name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">Masa aktif {fmtDur(Number(p.duration_hours))}</p>
                {p.description && <p className="text-sm text-slate-500 mt-2 flex-1">{p.description}</p>}
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-2xl font-extrabold text-brand-600">{idr(p.price)}</p>
                  <button className="btn-primary" onClick={() => { setSelected(p); setErr(null); }}>
                    Beli
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!bought && !loading && pkgs.length === 0 && !err && (
          <p className="card text-center text-sm text-slate-400">Belum ada paket voucher yang tersedia.</p>
        )}

        <p className="text-center text-xs text-slate-400 mt-8">
          Sudah punya kode? Masukkan di halaman login hotspot WiFi kami untuk mulai berselancar.
        </p>
      </div>

      {/* modal beli */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="card w-full max-w-md shadow-soft animate-fade-up">
            <h3 className="font-extrabold text-slate-900 text-lg mb-1">Beli {selected.name}</h3>
            <p className="text-sm text-slate-500 mb-5">
              {idr(selected.price)} · aktif {fmtDur(Number(selected.duration_hours))}
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">Nama (opsional)</label>
                <input
                  className="input"
                  placeholder="Nama Anda"
                  value={buyer.name}
                  onChange={(e) => setBuyer((b) => ({ ...b, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">No. HP / WhatsApp (opsional)</label>
                <input
                  className="input"
                  placeholder="08xxxxxxxxxx"
                  value={buyer.phone}
                  onChange={(e) => setBuyer((b) => ({ ...b, phone: e.target.value }))}
                />
              </div>
            </div>
            {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
            <div className="flex gap-2 mt-6">
              <button className="btn-outline flex-1" disabled={buying} onClick={() => setSelected(null)}>
                Batal
              </button>
              <button className="btn-primary flex-1" disabled={buying} onClick={buy}>
                {buying ? "Memproses…" : "Buat Voucher"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
