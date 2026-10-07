"use client";

import { useEffect, useMemo, useState } from "react";
import { api, asList } from "@/lib/api";
import { periodLabel, rupiah, todayID } from "@/lib/utils";

function settingsToMap(d: any): Record<string, string> {
  const map: Record<string, string> = {};
  if (!d) return map;
  if (Array.isArray(d)) {
    for (const s of d) if (s?.key) map[String(s.key)] = String(s.value ?? "");
    return map;
  }
  const obj = d.settings ?? d.data ?? d;
  if (typeof obj === "object") for (const k of Object.keys(obj)) map[k] = String((obj as any)[k] ?? "");
  return map;
}

export default function CetakInvoicePage({ params }: { params: { id: string } }) {
  const [inv, setInv] = useState<any>(null);
  const [company, setCompany] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [i, s] = await Promise.all([
          api<any>(`/api/invoices/${params.id}`),
          api<any>("/api/settings").catch(() => null),
        ]);
        setInv(i);
        setCompany(settingsToMap(s));
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [params.id]);

  useEffect(() => {
    if (inv && !printed) {
      setPrinted(true);
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [inv, printed]);

  const items = asList(inv?.items);
  const cname = company.company_name || company.nama_perusahaan || "GenISP";
  const caddr = company.company_address || company.alamat || "";
  const cphone = company.company_phone || company.telepon || "";
  const cmail = company.company_email || company.email || "";

  const paidTotal = useMemo(
    () => asList(inv?.payments ?? inv?.payment_history).reduce((a: number, p: any) => a + Number(p.amount ?? 0), 0),
    [inv]
  );
  const total = Number(inv?.amount ?? inv?.total ?? 0);

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 14mm; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between">
        <button type="button" onClick={() => window.history.back()}
          className="btn-outline !py-2 text-sm">Kembali</button>
        <button type="button" onClick={() => window.print()} className="btn-primary !py-2 text-sm">
          Cetak / Simpan PDF
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700">
          Gagal memuat invoice: {error}
        </div>
      ) : !inv ? (
        <div className="rounded-2xl bg-white p-12 text-center text-sm text-slate-400">Memuat invoice...</div>
      ) : (
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-card print:rounded-none print:border-0 print:shadow-none">
          {/* Kop */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{cname}</h1>
              {caddr && <p className="mt-1 text-xs text-slate-500">{caddr}</p>}
              <p className="text-xs text-slate-500">{[cphone, cmail].filter(Boolean).join(" • ")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Invoice</p>
              <p className="font-mono text-sm font-bold">{inv.code ?? inv.kode}</p>
              <p className="mt-1 text-xs text-slate-500">{periodLabel(String(inv.period ?? ""))}</p>
            </div>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-4 py-5 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ditagihkan kepada</p>
              <p className="mt-1 font-bold text-slate-900">{inv.customer_name ?? inv.customer?.name ?? "-"}</p>
              <p className="text-xs text-slate-500">{inv.customer?.address ?? inv.customer_address ?? ""}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Jatuh tempo</p>
              <p className="mt-1 font-semibold">{inv.due_date ? todayID(inv.due_date) : "-"}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
              <p className="font-bold uppercase">{inv.status}</p>
            </div>
          </div>

          {/* Tabel rincian */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Deskripsi</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td className="px-4 py-3">Tagihan layanan internet {periodLabel(String(inv.period ?? ""))}</td>
                  <td className="px-4 py-3 text-right">{rupiah(total)}</td></tr>
              )}
              {items.map((it: any, i: number) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-4 py-3">{it.description ?? it.name}</td>
                  <td className="px-4 py-3 text-right">{rupiah(it.amount ?? it.price ?? 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-4 py-3 text-right font-bold">Total Tagihan</td>
                <td className="px-4 py-3 text-right font-bold">{rupiah(total)}</td>
              </tr>
              <tr>
                <td className="px-4 py-1 text-right text-slate-500">Sudah Dibayar</td>
                <td className="px-4 py-1 text-right text-slate-500">{rupiah(paidTotal)}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-right text-base font-extrabold">Sisa</td>
                <td className="px-4 py-2 text-right text-base font-extrabold">{rupiah(total - paidTotal)}</td>
              </tr>
            </tfoot>
          </table>

          <p className="mt-8 text-center text-xs text-slate-400">
            Terima kasih atas kepercayaan Anda menggunakan layanan {cname}.
          </p>
        </div>
      )}
    </>
  );
}
