"use client";

import { useState } from "react";
import {
  DataTable, Field, FormError, Icon,
  Modal, PageHeader, RowBtn, Select, Stat,
} from "@/components/admin";
import { api, asList, useApi } from "@/lib/api";
import { rupiah, todayID } from "@/lib/utils";

type Wallet = {
  id: number;
  owner_type: string;
  owner_id: number;
  balance: number | string;
  points: number | string;
  owner_name?: string;
  owner_phone?: string;
};

type Ledger = {
  id: number;
  direction: string;
  amount: number | string;
  balance_after: number | string;
  reference_type?: string | null;
  description?: string | null;
  created_at: string;
};

export default function WalletPage() {
  const wallets = useApi<unknown>("/api/wallets");
  const list = asList<Wallet>(wallets.data);

  const [history, setHistory] = useState<Wallet | null>(null);
  const ledger = useApi<unknown>(history ? `/api/wallets/${history.id}` : null);
  const ledgerList = asList<Ledger>((ledger.data as { ledger?: unknown })?.ledger);

  const [adj, setAdj] = useState<Wallet | null>(null);
  const [form, setForm] = useState({ type: "credit", amount: "", description: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalBalance = list.reduce((a, w) => a + Number(w.balance ?? 0), 0);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function openAdjust(w: Wallet) {
    setAdj(w);
    setForm({ type: "credit", amount: "", description: "" });
    setErr(null);
  }

  async function saveAdjust() {
    if (!adj) return;
    if (!form.amount || Number(form.amount) <= 0) { setErr("Nominal tidak valid."); return; }
    setSaving(true); setErr(null);
    try {
      await api(`/api/wallets/${adj.id}/adjust`, {
        method: "POST",
        body: JSON.stringify({
          type: form.type,
          amount: Number(form.amount),
          description: form.description,
        }),
      });
      setAdj(null); wallets.reload();
      if (history && history.id === adj.id) ledger.reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader title="Wallet" subtitle="Saldo pelanggan & partner" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat label="Total Wallet" icon="wallet" accent="bg-brand-50 text-brand-600"
          value={String(list.length)} sub="Akun terdaftar" />
        <Stat label="Total Saldo" icon="chart" accent="bg-green-50 text-green-600"
          value={rupiah(totalBalance)} sub="Semua wallet" />
      </div>

      <div className="mt-6">
        <DataTable
          loading={wallets.loading} rows={list} emptyText="Belum ada wallet"
          rowKey={(r) => String(r.id)}
          columns={[
            {
              key: "owner", label: "Pemilik",
              render: (r: Wallet) => (
                <div>
                  <div className="font-semibold">{r.owner_name ?? `#${r.owner_id}`}</div>
                  <div className="text-xs text-slate-400">{r.owner_phone ?? "-"}</div>
                </div>
              ),
            },
            {
              key: "type", label: "Tipe",
              render: (r: Wallet) => (
                <span className={`badge ${r.owner_type === "customer" ? "bg-brand-50 text-brand-700" : "bg-orange-50 text-orange-700"}`}>
                  {r.owner_type === "customer" ? "Pelanggan" : "Partner"}
                </span>
              ),
            },
            {
              key: "balance", label: "Saldo", className: "text-right",
              render: (r: Wallet) => <span className="font-bold text-brand-700">{rupiah(r.balance ?? 0)}</span>,
            },
            { key: "points", label: "Poin", className: "text-right", render: (r: Wallet) => String(r.points ?? 0) },
          ]}
          actions={(r: Wallet) => (
            <div className="flex justify-end gap-1">
              <RowBtn title="Riwayat" icon="receipt" onClick={() => setHistory(r)} />
              <RowBtn title="Adjust" icon="plus" tone="green" onClick={() => openAdjust(r)} />
            </div>
          )}
        />
      </div>

      {/* Riwayat ledger */}
      <Modal open={!!history} onClose={() => setHistory(null)} wide
        title={`Riwayat — ${history?.owner_name ?? ""}`}>
        <DataTable
          loading={ledger.loading} rows={ledgerList} emptyText="Belum ada transaksi"
          rowKey={(r) => String(r.id)}
          columns={[
            {
              key: "created_at", label: "Waktu",
              render: (r: Ledger) => <span className="whitespace-nowrap">{todayID(r.created_at)}</span>,
            },
            {
              key: "direction", label: "Arah",
              render: (r: Ledger) => (
                <span className={`font-bold ${r.direction === "credit" ? "text-green-700" : "text-red-600"}`}>
                  {r.direction === "credit" ? "+" : "-"}{rupiah(r.amount ?? 0)}
                </span>
              ),
            },
            { key: "reference_type", label: "Ref", render: (r: Ledger) => <span className="badge bg-slate-100 text-slate-600">{r.reference_type ?? "-"}</span> },
            { key: "description", label: "Keterangan", render: (r: Ledger) => <span className="line-clamp-2 max-w-xs">{r.description ?? "-"}</span> },
            {
              key: "balance_after", label: "Saldo Akhir", className: "text-right",
              render: (r: Ledger) => <span className="font-semibold">{rupiah(r.balance_after ?? 0)}</span>,
            },
          ]}
        />
      </Modal>

      {/* Adjust saldo */}
      <Modal open={!!adj} onClose={() => setAdj(null)} title={`Adjust Saldo — ${adj?.owner_name ?? ""}`}>
        <FormError message={err} />
        <div className="grid grid-cols-1 gap-4">
          <Field label="Tipe">
            <Select value={form.type} onChange={(e) => set("type", e.target.value)}>
              <option value="credit">Tambah (credit)</option>
              <option value="debit">Kurangi (debit)</option>
            </Select>
          </Field>
          <Field label="Nominal (Rp)">
            <input className="input" type="number" min={0} value={form.amount}
              onChange={(e) => set("amount", e.target.value)} placeholder="50000" />
          </Field>
          <Field label="Keterangan">
            <textarea className="input" rows={2} value={form.description}
              onChange={(e) => set("description", e.target.value)} placeholder="Alasan adjust..." />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setAdj(null)}>Batal</button>
          <button type="button" className="btn-primary" onClick={saveAdjust} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
