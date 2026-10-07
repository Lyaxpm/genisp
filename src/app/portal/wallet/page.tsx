"use client";

import { useState } from "react";
import { Field } from "@/components/public";
import { api, asList, useApi } from "@/lib/api";
import { idr, dateID } from "@/lib/public-types";
import { rupiah } from "@/lib/utils";

function IconPlus({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="card relative w-full max-w-md !p-6">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

type Ledger = {
  id: number;
  direction: string;
  amount: number | string;
  balance_after: number | string;
  reference_type?: string | null;
  description?: string | null;
  created_at: string;
};

export default function PortalWalletPage() {
  const wallet = useApi<unknown>("/api/wallet/me");
  const d = (wallet.data as { wallet?: { balance?: number | string; points?: number | string }; ledger?: unknown }) ?? {};
  const ledger = asList<Ledger>(d.ledger);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ amount: "", gateway: "manual" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function topup() {
    if (!form.amount || Number(form.amount) <= 0) { setErr("Nominal tidak valid."); return; }
    setSaving(true); setErr(null); setDone(null);
    try {
      const res = await api<{ manual?: boolean; instruction?: string; checkout?: { payment_url?: string; qr_url?: string } }>(
        "/api/wallet/topup",
        { method: "POST", body: JSON.stringify({ amount: Number(form.amount), gateway: form.gateway }) }
      );
      setModal(false);
      if (res.manual) {
        setDone(res.instruction ?? "Topup tercatat. Hubungi CS untuk verifikasi.");
      } else if (res.checkout?.payment_url) {
        window.location.href = res.checkout.payment_url;
        return;
      } else {
        setDone("Topup dibuat. Selesaikan pembayaran lalu hubungi CS.");
      }
      wallet.reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Wallet Saya</h1>
      <p className="mt-1 text-sm text-slate-500">Saldo untuk pembayaran tagihan & pembelian voucher</p>

      {done && (
        <div className="card mt-4 border-green-200 bg-green-50 text-sm text-green-800">{done}</div>
      )}

      <div className="card mt-4 bg-gradient-to-br from-brand-500 to-brand-700 text-white">
        <div className="text-xs uppercase tracking-widest text-brand-100">Saldo Aktif</div>
        <div className="mt-1 text-4xl font-extrabold">
          {wallet.loading ? "..." : rupiah(d.wallet?.balance ?? 0)}
        </div>
        <div className="mt-1 text-sm text-brand-100">{d.wallet?.points ?? 0} poin</div>
        <button type="button" onClick={() => { setModal(true); setErr(null); }}
          className="btn mt-4 bg-white text-brand-700 hover:bg-brand-50 font-bold">
          <IconPlus /> Topup Saldo
        </button>
      </div>

      <h2 className="mt-8 text-lg font-bold text-slate-900">Riwayat Transaksi</h2>
      <div className="card mt-3 divide-y divide-slate-100 !p-0">
        {wallet.loading && <div className="p-5 text-sm text-slate-400">Memuat...</div>}
        {!wallet.loading && ledger.length === 0 && (
          <div className="p-5 text-sm text-slate-400">Belum ada transaksi.</div>
        )}
        {ledger.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800">
                {l.description ?? l.reference_type ?? "-"}
              </div>
              <div className="text-xs text-slate-400">{dateID(l.created_at)}</div>
            </div>
            <div className={`whitespace-nowrap text-sm font-bold ${l.direction === "credit" ? "text-green-700" : "text-red-600"}`}>
              {l.direction === "credit" ? "+" : "-"}{idr(l.amount)}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Topup Saldo">
        {err && <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{err}</div>}
        <div className="grid grid-cols-1 gap-4">
          <Field label="Nominal (Rp)">
            <input className="input" type="number" min={0} value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="50000" />
          </Field>
          <Field label="Metode Pembayaran">
            <select className="input" value={form.gateway}
              onChange={(e) => setForm((f) => ({ ...f, gateway: e.target.value }))}>
              <option value="manual">Transfer Manual</option>
              <option value="xendit">Xendit (VA/E-Wallet)</option>
              <option value="midtrans">Midtrans</option>
              <option value="tripay">Tripay</option>
            </select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setModal(false)}>Batal</button>
          <button type="button" className="btn-primary" onClick={topup} disabled={saving}>
            {saving ? "Memproses..." : "Lanjut"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
