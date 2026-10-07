"use client";

import { useEffect, useState } from "react";
import { DataTable, ErrorBox, Icon, PageHeader, Skeleton, Stat } from "@/components/admin";
import { api } from "@/lib/api";
import { periodLabel, rupiah } from "@/lib/utils";

function lastMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

type MonthRow = { month: string; income: number; expense: number };

export default function LaporanPage() {
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const months = lastMonths(6);
      const results = await Promise.all(
        months.map(async (m) => {
          try {
            const d: any = await api<any>(`/api/finance/summary?from=${m}`);
            const monthly = d?.monthly ?? d?.per_month;
            const found = Array.isArray(monthly)
              ? monthly.find((x: any) => String(x.month ?? x.periode ?? "").startsWith(m))
              : null;
            const src = found ?? d ?? {};
            return {
              month: m,
              income: Number(src.income ?? src.pemasukan ?? src.total_income ?? 0),
              expense: Number(src.expense ?? src.pengeluaran ?? src.total_expense ?? 0),
            } as MonthRow;
          } catch {
            return { month: m, income: 0, expense: 0 } as MonthRow;
          }
        })
      );
      setRows(results);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const totIn = rows.reduce((a, r) => a + r.income, 0);
  const totOut = rows.reduce((a, r) => a + r.expense, 0);

  function exportCSV() {
    const head = "Bulan,Pemasukan,Pengeluaran,Saldo";
    const lines = rows.map((r) =>
      [`"${periodLabel(r.month)}"`, r.income, r.expense, r.income - r.expense].join(","));
    lines.push([`"Total"`, totIn, totOut, totIn - totOut].join(","));
    const csv = "\uFEFF" + [head, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-keuangan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Laporan"
        subtitle="Rekap keuangan 6 bulan terakhir"
        actions={
          <>
            <button type="button" className="btn-outline" onClick={load}>
              <Icon name="refresh" className="h-4 w-4" /> Muat ulang
            </button>
            <button type="button" className="btn-primary" onClick={exportCSV} disabled={rows.length === 0}>
              <Icon name="download" className="h-4 w-4" /> Export CSV
            </button>
          </>
        }
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <Stat label="Total Pemasukan" icon="wallet" accent="bg-green-50 text-green-600"
              value={rupiah(totIn)} sub="6 bulan terakhir" />
            <Stat label="Total Pengeluaran" icon="receipt" accent="bg-red-50 text-red-600"
              value={rupiah(totOut)} sub="6 bulan terakhir" />
            <Stat label="Saldo Bersih" icon="chart"
              value={rupiah(totIn - totOut)} sub="Pemasukan − pengeluaran" />
          </>
        )}
      </div>

      <div className="card mt-6">
        <h2 className="mb-4 text-base font-bold text-slate-900">Rekap Bulanan</h2>
        <DataTable
          loading={loading}
          rows={rows}
          emptyText="Belum ada data rekap"
          rowKey={(r: MonthRow) => r.month}
          columns={[
            { key: "month", label: "Bulan", render: (r: MonthRow) => <span className="font-semibold">{periodLabel(r.month)}</span> },
            { key: "income", label: "Pemasukan", className: "text-right", render: (r: MonthRow) => <span className="font-medium text-green-700">{rupiah(r.income)}</span> },
            { key: "expense", label: "Pengeluaran", className: "text-right", render: (r: MonthRow) => <span className="font-medium text-red-600">{rupiah(r.expense)}</span> },
            {
              key: "balance", label: "Saldo", className: "text-right",
              render: (r: MonthRow) => (
                <span className={`font-bold ${r.income - r.expense >= 0 ? "text-slate-900" : "text-red-600"}`}>
                  {rupiah(r.income - r.expense)}
                </span>
              ),
            },
          ]}
        />
        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <span className="font-bold text-slate-700">Total 6 bulan</span>
            <span className="font-bold text-brand-700">{rupiah(totIn - totOut)}</span>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Data diambil dari endpoint /api/finance/summary per bulan. File CSV dapat dibuka di Excel / Google Sheets.
      </p>
    </div>
  );
}
