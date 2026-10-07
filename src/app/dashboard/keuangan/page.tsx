"use client";

import { useState } from "react";
import {
  ConfirmDialog, DataTable, Field, FormError, Icon,
  Modal, PageHeader, RowBtn, Select, Stat, Tabs,
} from "@/components/admin";
import { api, asList, toDateInput, useApi } from "@/lib/api";
import { rupiah, todayID } from "@/lib/utils";

const KATEGORI_MASUK = ["Tagihan pelanggan", "Voucher", "Instalasi", "Lainnya"];
const KATEGORI_KELUAR = ["Operasional", "Gaji", "Perangkat", "Sewa", "Internet backbone", "Lainnya"];

function monthRange() {
  const d = new Date();
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const to = d.toISOString().slice(0, 10);
  return { from, to };
}

export default function KeuanganPage() {
  const [tab, setTab] = useState("masuk");
  const [from, setFrom] = useState(monthRange().from);
  const [to, setTo] = useState(monthRange().to);

  const summary = useApi<any>(`/api/finance/summary?from=${from}&to=${to}`);
  const tx = useApi<any>(tab === "pending" ? null : `/api/finance/transactions?type=${tab}&from=${from}&to=${to}`);
  const pending = useApi<any>(tab === "pending" ? "/api/finance/pending?status=pending" : null);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ date: toDateInput(), category: "", amount: "", method: "cash", description: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<any>(null);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const s = summary.data ?? {};
  const list = asList(tx.data);
  const pendingList = asList(pending.data);
  const cats = tab === "masuk" ? KATEGORI_MASUK : tab === "keluar" ? KATEGORI_KELUAR : KATEGORI_MASUK;

  function openAdd() {
    setForm({ date: toDateInput(), category: cats[0], amount: "", method: "cash", description: "" });
    setErr(null); setModal(true);
  }

  async function save() {
    if (!form.amount || Number(form.amount) <= 0) { setErr("Nominal tidak valid."); return; }
    setSaving(true); setErr(null);
    try {
      if (tab === "pending") {
        await api("/api/finance/pending", {
          method: "POST",
          body: JSON.stringify({
            date: form.date, category: form.category,
            amount: Number(form.amount), method: form.method, description: form.description,
          }),
        });
        setModal(false); pending.reload();
      } else {
        await api("/api/finance/transactions", {
          method: "POST",
          body: JSON.stringify({
            type: tab === "masuk" ? "income" : "expense",
            date: form.date, category: form.category,
            amount: Number(form.amount), method: form.method, description: form.description,
          }),
        });
        setModal(false); tx.reload(); summary.reload();
      }
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  async function reviewPending(id: number, action: "approve" | "reject") {
    try {
      await api(`/api/finance/pending/${id}/${action}`, { method: "POST" });
      pending.reload(); summary.reload();
    } catch (e: any) { alert(e.message); }
  }

  async function remove() {
    if (!del) return;
    try { await api(`/api/finance/transactions/${del.id}`, { method: "DELETE" }); setDel(null); tx.reload(); summary.reload(); }
    catch (e: any) { alert(e.message); }
  }

  return (
    <div>
      <PageHeader title="Keuangan" subtitle="Arus kas pemasukan & pengeluaran" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total Pemasukan" icon="wallet" accent="bg-green-50 text-green-600"
          value={rupiah(s.income ?? s.total_income ?? s.pemasukan ?? 0)} sub="Periode terpilih" />
        <Stat label="Total Pengeluaran" icon="receipt" accent="bg-red-50 text-red-600"
          value={rupiah(s.expense ?? s.total_expense ?? s.pengeluaran ?? 0)} sub="Periode terpilih" />
        <Stat label="Saldo" icon="chart" accent="bg-brand-50 text-brand-600"
          value={rupiah(s.balance ?? s.saldo ?? (Number(s.income ?? 0) - Number(s.expense ?? 0)))} sub="Masuk − Keluar" />
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={tab} onChange={setTab}
          tabs={[
            { key: "masuk", label: "Pemasukan", icon: "download" },
            { key: "keluar", label: "Pengeluaran", icon: "wallet" },
            { key: "pending", label: "Pending Approval", icon: "clock" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          {tab !== "pending" && (
            <>
              <input type="date" className="input !w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-slate-400">–</span>
              <input type="date" className="input !w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
          <button type="button" className="btn-primary" onClick={openAdd}>
            <Icon name="plus" className="h-4 w-4" /> {tab === "pending" ? "Ajukan" : "Tambah"}
          </button>
        </div>
      </div>

      {tab === "pending" ? (
        <div className="mt-4">
          <DataTable
            loading={pending.loading} rows={pendingList} emptyText="Tidak ada pengajuan menunggu persetujuan"
            rowKey={(r: any) => String(r.id)}
            columns={[
              { key: "date", label: "Tanggal", render: (r: any) => <span className="whitespace-nowrap">{r.date ? todayID(r.date) : "-"}</span> },
              { key: "category", label: "Kategori", render: (r: any) => <span className="badge bg-slate-100 text-slate-600">{r.category_name ?? "-"}</span> },
              { key: "description", label: "Deskripsi", render: (r: any) => <span className="line-clamp-2 max-w-xs">{r.description ?? "-"}</span> },
              { key: "created_by", label: "Diajukan", render: (r: any) => r.created_by_name ?? "-" },
              {
                key: "amount", label: "Nominal", className: "text-right",
                render: (r: any) => <span className="font-bold text-amber-700">{rupiah(r.amount ?? 0)}</span>,
              },
            ]}
            actions={(r: any) => (
              <div className="flex justify-end gap-1">
                <button type="button" className="btn-primary !px-3 !py-1.5 text-xs"
                  onClick={() => reviewPending(r.id, "approve")}>
                  <Icon name="check" className="h-3.5 w-3.5" /> Setujui
                </button>
                <button type="button" className="btn-outline !px-3 !py-1.5 text-xs !text-red-600"
                  onClick={() => reviewPending(r.id, "reject")}>
                  <Icon name="x" className="h-3.5 w-3.5" /> Tolak
                </button>
              </div>
            )}
          />
        </div>
      ) : (
      <div className="mt-4">
        <DataTable
          loading={tx.loading} rows={list} emptyText="Belum ada transaksi pada periode ini"
          rowKey={(r: any) => String(r.id)}
          columns={[
            { key: "date", label: "Tanggal", render: (r: any) => <span className="whitespace-nowrap">{r.date ? todayID(r.date) : "-"}</span> },
            { key: "category", label: "Kategori", render: (r: any) => <span className="badge bg-slate-100 text-slate-600">{r.category ?? "-"}</span> },
            { key: "description", label: "Deskripsi", render: (r: any) => <span className="line-clamp-2 max-w-xs">{r.description ?? "-"}</span> },
            { key: "method", label: "Metode", render: (r: any) => <span className="capitalize">{r.method ?? "-"}</span> },
            {
              key: "amount", label: "Nominal", className: "text-right",
              render: (r: any) => (
                <span className={`font-bold ${tab === "masuk" ? "text-green-700" : "text-red-600"}`}>
                  {tab === "masuk" ? "+" : "-"}{rupiah(r.amount ?? 0)}
                </span>
              ),
            },
          ]}
          actions={(r: any) => <RowBtn title="Hapus" icon="trash" tone="red" onClick={() => setDel(r)} />}
        />
      </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)}
        title={tab === "pending" ? "Ajukan Pemasukan" : tab === "masuk" ? "Tambah Pemasukan" : "Tambah Pengeluaran"}>
        <FormError message={err} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tanggal">
            <input type="date" className="input" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Kategori">
            <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Nominal (Rp)" className="sm:col-span-2">
            <input className="input" type="number" min={0} value={form.amount}
              onChange={(e) => set("amount", e.target.value)} placeholder="100000" />
          </Field>
          <Field label="Metode" className="sm:col-span-2">
            <Select value={form.method} onChange={(e) => set("method", e.target.value)}>
              <option value="cash">Tunai</option>
              <option value="transfer">Transfer Bank</option>
              <option value="qris">QRIS</option>
              <option value="ewallet">E-Wallet</option>
              <option value="gateway">Payment Gateway</option>
            </Select>
          </Field>
          <Field label="Deskripsi" className="sm:col-span-2">
            <textarea className="input" rows={2} value={form.description}
              onChange={(e) => set("description", e.target.value)} placeholder="Keterangan transaksi..." />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setModal(false)}>Batal</button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger
        title="Hapus Transaksi" confirmLabel="Ya, hapus"
        message={<>Hapus transaksi <b>{rupiah(del?.amount ?? 0)}</b> ({del?.category})?</>} />
    </div>
  );
}
