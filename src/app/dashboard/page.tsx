"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable, ErrorBox, Icon, PageHeader, Skeleton, Stat, StatusBadge } from "@/components/admin";
import { asList, useApi } from "@/lib/api";
import { periodLabel, rupiah, todayID } from "@/lib/utils";

function sixMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 5, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const summary = useApi<any>("/api/reports/summary");
  const finance = useApi<any>(`/api/finance/summary?from=${sixMonthsAgo()}`);

  const s = summary.data ?? {};
  const monthly: any[] = asList(s.monthly ?? finance.data?.monthly ?? finance.data?.per_month);
  const recent = asList(s.recent_invoices ?? s.latest_invoices).slice(0, 5);
  const isolated = asList(s.isolated_customers ?? s.isolated);

  const chartData = monthly.map((m: any) => ({
    name: periodLabel(String(m.month ?? m.periode ?? "")).split(" ")[0].slice(0, 3),
    Pendapatan: Number(m.income ?? m.pemasukan ?? 0),
    Pengeluaran: Number(m.expense ?? m.pengeluaran ?? 0),
  }));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Ringkasan bisnis per ${todayID()}`}
        actions={
          <button type="button" className="btn-outline" onClick={() => { summary.reload(); finance.reload(); }}>
            <Icon name="refresh" className="h-4 w-4" /> Muat ulang
          </button>
        }
      />

      {summary.error && <div className="mb-6"><ErrorBox message={summary.error} onRetry={summary.reload} /></div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <Stat label="Total Pelanggan" icon="users"
              value={s.total_customers ?? s.totalCustomers ?? 0}
              sub={`${s.active_customers ?? 0} aktif`} />
            <Stat label="Tagihan Belum Bayar" icon="receipt" accent="bg-amber-50 text-amber-600"
              value={s.unpaid_count ?? s.unpaidCount ?? 0}
              sub={rupiah(s.unpaid_amount ?? s.unpaidAmount ?? 0)} />
            <Stat label="Pendapatan Bulan Ini" icon="wallet" accent="bg-green-50 text-green-600"
              value={rupiah(s.revenue_this_month ?? s.revenueThisMonth ?? 0)}
              sub={periodLabel(new Date().toISOString().slice(0, 7))} />
            <Stat label="Voucher Aktif" icon="ticket" accent="bg-orange-50 text-orange-600"
              value={s.active_vouchers ?? s.activeVouchers ?? 0}
              sub="Hotspot" />
          </>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Arus Kas 6 Bulan</h2>
              <p className="text-xs text-slate-400">Perbandingan pemasukan vs pengeluaran</p>
            </div>
            <Link href="/dashboard/laporan" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              Lihat laporan
            </Link>
          </div>
          {finance.loading ? (
            <Skeleton className="h-64" />
          ) : chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => v >= 1000000 ? `${Math.round(v / 1000000)}jt` : `${Math.round(v / 1000)}rb`} />
                  <Tooltip
                    formatter={(v: any) => rupiah(Number(v))}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Bar dataKey="Pendapatan" fill="#0d627c" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Pengeluaran" fill="#fb923c" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 text-center">
              <Icon name="chart" className="h-10 w-10 text-slate-200" />
              <p className="text-sm font-semibold text-slate-500">Data grafik belum tersedia</p>
              <p className="max-w-xs text-xs text-slate-400">
                Endpoint /api/finance/summary belum mengembalikan data bulanan.
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Pelanggan Isolir</h2>
            <span className="badge bg-red-100 text-red-700">{isolated.length}</span>
          </div>
          {summary.loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : isolated.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                <Icon name="check" className="h-5 w-5" />
              </span>
              <p className="text-sm text-slate-500">Tidak ada pelanggan terisolir</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {isolated.slice(0, 6).map((c: any, i: number) => (
                <li key={c.id ?? i} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{c.name ?? c.nama}</p>
                    <p className="truncate text-xs text-slate-400">{c.phone ?? c.telepon ?? "-"}</p>
                  </div>
                  <StatusBadge status="isolir" />
                </li>
              ))}
            </ul>
          )}
          <Link href="/dashboard/pelanggan"
            className="mt-3 block text-center text-xs font-semibold text-brand-600 hover:text-brand-700">
            Kelola pelanggan
          </Link>
        </div>
      </div>

      <div className="card mt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Tagihan Terbaru</h2>
            <p className="text-xs text-slate-400">5 tagihan paling baru</p>
          </div>
          <Link href="/dashboard/tagihan" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
            Semua tagihan
          </Link>
        </div>
        <DataTable
          loading={summary.loading}
          rows={recent}
          emptyText="Belum ada tagihan"
          columns={[
            { key: "code", label: "Kode", render: (r: any) => <span className="font-mono text-xs font-semibold">{r.code ?? r.kode ?? "-"}</span> },
            { key: "customer", label: "Pelanggan", render: (r: any) => r.customer_name ?? r.customer?.name ?? "-" },
            { key: "period", label: "Periode", render: (r: any) => periodLabel(String(r.period ?? r.periode ?? "")) },
            { key: "amount", label: "Nominal", className: "text-right", render: (r: any) => <span className="font-semibold">{rupiah(r.amount ?? r.total ?? 0)}</span> },
            { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
          ]}
        />
      </div>
    </div>
  );
}
