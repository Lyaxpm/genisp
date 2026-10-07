"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DataTable, ErrorBox, Field, FormError, Icon,
  Modal, PageHeader, RowBtn, SearchInput, Select, StatusBadge,
} from "@/components/admin";
import { api, asList, toDateInput, useApi } from "@/lib/api";
import { periodLabel, rupiah, todayID } from "@/lib/utils";

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function TagihanPage() {
  const invoices = useApi<any>("/api/invoices");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("semua");
  const [periodFilter, setPeriodFilter] = useState("");

  const [genOpen, setGenOpen] = useState(false);
  const [genPeriod, setGenPeriod] = useState(currentPeriod());
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = useApi<any>(detailId ? `/api/invoices/${detailId}` : null);

  const [payId, setPayId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ method: "transfer", amount: "", note: "" });
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const list = asList(invoices.data);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((inv: any) => {
      const st = String(inv.status ?? "").toLowerCase();
      if (statusFilter !== "semua" && st !== statusFilter) return false;
      if (periodFilter && !String(inv.period ?? "").startsWith(periodFilter)) return false;
      if (!needle) return true;
      return [inv.code, inv.kode, inv.customer_name, inv.customer?.name].some((v) =>
        String(v ?? "").toLowerCase().includes(needle));
    });
  }, [list, q, statusFilter, periodFilter]);

  const d: any = detail.data ?? {};
  const dItems = asList(d.items);
  const dPayments = asList(d.payments ?? d.payment_history);

  async function generate() {
    setGenLoading(true); setGenError(null);
    try {
      const res = await api<any>("/api/invoices/generate", {
        method: "POST", body: JSON.stringify({ period: genPeriod }),
      });
      setGenOpen(false);
      invoices.reload();
      alert(`Berhasil membuat ${res?.created ?? res?.count ?? ""} tagihan periode ${periodLabel(genPeriod)}.`);
    } catch (e: any) {
      setGenError(e.message);
    } finally { setGenLoading(false); }
  }

  function openPay(inv: any) {
    setPayId(inv.id);
    setPayForm({ method: "transfer", amount: String(inv.amount ?? inv.total ?? ""), note: "" });
    setPayError(null);
  }

  async function pay() {
    if (!payId) return;
    if (!payForm.amount || Number(payForm.amount) <= 0) { setPayError("Nominal pembayaran tidak valid."); return; }
    setPayLoading(true); setPayError(null);
    try {
      await api(`/api/invoices/${payId}/pay`, {
        method: "POST",
        body: JSON.stringify({ method: payForm.method, amount: Number(payForm.amount), note: payForm.note }),
      });
      setPayId(null);
      invoices.reload();
      if (detailId === payId) detail.reload();
    } catch (e: any) {
      setPayError(e.message);
    } finally { setPayLoading(false); }
  }

  const unpaidTotal = filtered
    .filter((i: any) => ["unpaid", "belum_bayar", "pending"].includes(String(i.status).toLowerCase()))
    .reduce((a: number, i: any) => a + Number(i.amount ?? i.total ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Tagihan"
        subtitle={`${filtered.length} tagihan • Belum bayar: ${rupiah(unpaidTotal)}`}
        actions={
          <button type="button" className="btn-primary" onClick={() => { setGenError(null); setGenOpen(true); }}>
            <Icon name="plus" className="h-4 w-4" /> Generate Tagihan
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <SearchInput value={q} onChange={setQ} placeholder="Cari kode / nama pelanggan..." />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="semua">Semua status</option>
          <option value="unpaid">Belum Bayar</option>
          <option value="paid">Lunas</option>
          <option value="pending">Menunggu</option>
          <option value="failed">Gagal</option>
        </Select>
        <div className="flex items-center gap-2">
          <input type="month" className="input" value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)} />
          {periodFilter && (
            <button type="button" className="btn-outline !px-3" onClick={() => setPeriodFilter("")} title="Reset periode">
              <Icon name="x" className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {invoices.error && <div className="mb-4"><ErrorBox message={invoices.error} onRetry={invoices.reload} /></div>}

      <DataTable
        loading={invoices.loading}
        rows={filtered}
        emptyText="Belum ada tagihan"
        rowKey={(r: any) => String(r.id)}
        columns={[
          { key: "code", label: "Kode", render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code ?? r.kode ?? "-"}</span> },
          { key: "customer", label: "Pelanggan", render: (r: any) => r.customer_name ?? r.customer?.name ?? "-" },
          { key: "period", label: "Periode", render: (r: any) => periodLabel(String(r.period ?? "")) },
          { key: "due", label: "Jatuh Tempo", render: (r: any) => r.due_date ? todayID(r.due_date) : "-" },
          { key: "amount", label: "Nominal", className: "text-right", render: (r: any) => <span className="font-semibold">{rupiah(r.amount ?? r.total ?? 0)}</span> },
          { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
        ]}
        actions={(r: any) => (
          <>
            <RowBtn title="Detail" icon="eye" tone="brand" onClick={() => setDetailId(r.id)} />
            {!["paid", "lunas"].includes(String(r.status).toLowerCase()) && (
              <RowBtn title="Tandai Lunas" icon="check" tone="green" onClick={() => openPay(r)} />
            )}
            <Link href={`/dashboard/tagihan/${r.id}/cetak`} title="Cetak" target="_blank"
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
              <Icon name="printer" className="h-4 w-4" />
            </Link>
          </>
        )}
      />

      {/* Modal generate */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate Tagihan Bulanan">
        <FormError message={genError} />
        <Field label="Periode Tagihan">
          <input type="month" className="input" value={genPeriod} onChange={(e) => setGenPeriod(e.target.value)} />
        </Field>
        <p className="mt-2 text-xs text-slate-400">
          Membuat tagihan untuk semua pelanggan aktif pada periode {periodLabel(genPeriod)} yang belum memiliki tagihan.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setGenOpen(false)}>Batal</button>
          <button type="button" className="btn-primary" onClick={generate} disabled={genLoading}>
            {genLoading ? "Membuat..." : "Generate"}
          </button>
        </div>
      </Modal>

      {/* Modal detail */}
      <Modal open={!!detailId} onClose={() => setDetailId(null)} title="Detail Tagihan" wide>
        {detail.loading ? (
          <p className="text-sm text-slate-400">Memuat detail...</p>
        ) : detail.error ? (
          <ErrorBox message={detail.error} onRetry={detail.reload} />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-bold">{d.code ?? d.kode}</p>
                <p className="text-xs text-slate-400">{d.customer_name ?? d.customer?.name} • {periodLabel(String(d.period ?? ""))}</p>
              </div>
              <StatusBadge status={d.status} />
            </div>
            <div>
              <h4 className="mb-2 text-sm font-bold text-slate-900">Rincian</h4>
              <ul className="divide-y divide-slate-50 rounded-xl border border-slate-100">
                {dItems.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">Tidak ada rincian item.</li>}
                {dItems.map((it: any, i: number) => (
                  <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>{it.description ?? it.name ?? `Item ${i + 1}`}</span>
                    <span className="font-semibold">{rupiah(it.amount ?? it.price ?? 0)}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between bg-slate-50 px-4 py-2.5 text-sm font-bold">
                  <span>Total</span><span>{rupiah(d.amount ?? d.total ?? 0)}</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-bold text-slate-900">Riwayat Pembayaran</h4>
              {dPayments.length === 0 ? (
                <p className="text-sm text-slate-400">Belum ada pembayaran tercatat.</p>
              ) : (
                <ul className="divide-y divide-slate-50 rounded-xl border border-slate-100">
                  {dPayments.map((p: any, i: number) => (
                    <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div>
                        <p className="font-medium capitalize">{p.method ?? "-"}</p>
                        <p className="text-xs text-slate-400">{p.paid_at ? todayID(p.paid_at) : ""} {p.note ? `• ${p.note}` : ""}</p>
                      </div>
                      <span className="font-semibold text-green-700">{rupiah(p.amount ?? 0)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal tandai lunas */}
      <Modal open={!!payId} onClose={() => setPayId(null)} title="Tandai Lunas">
        <FormError message={payError} />
        <div className="space-y-4">
          <Field label="Metode Pembayaran">
            <Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              <option value="transfer">Transfer Bank</option>
              <option value="cash">Tunai</option>
              <option value="qris">QRIS</option>
              <option value="ewallet">E-Wallet</option>
              <option value="gateway">Payment Gateway</option>
            </Select>
          </Field>
          <Field label="Nominal Dibayar">
            <input className="input" type="number" min={0} value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
          </Field>
          <Field label="Catatan (opsional)">
            <input className="input" value={payForm.note}
              onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
              placeholder="cth: diterima via BCA" />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setPayId(null)}>Batal</button>
          <button type="button" className="btn-primary" onClick={pay} disabled={payLoading}>
            {payLoading ? "Menyimpan..." : "Simpan Pembayaran"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
