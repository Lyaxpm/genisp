import Link from "next/link";
import { cookies } from "next/headers";
import {
  StatusBadge,
  asInvoices,
  dateID,
  idr,
  invoiceTotal,
  periodLabel,
  type Invoice,
} from "@/components/public";

async function getInvoices(): Promise<Invoice[]> {
  try {
    const res = await fetch("/api/portal/invoices", {
      headers: { Cookie: cookies().toString() },
      cache: "no-store",
    });
    const j = await res.json().catch(() => null);
    return j && j.ok ? asInvoices(j.data) : [];
  } catch {
    return [];
  }
}

export default async function TagihanPage() {
  const invoices = await getInvoices();
  const sorted = [...invoices].sort((a, b) => String(b.code).localeCompare(String(a.code)));

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Riwayat Tagihan</h1>
        <p className="text-sm text-slate-500 mt-1">Semua invoice Anda — yang sudah lunas maupun yang belum dibayar.</p>
      </div>

      <div className="card !p-0 overflow-hidden animate-fade-up" style={{ animationDelay: "80ms" }}>
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">Belum ada data tagihan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="th">Kode</th>
                  <th className="th">Periode</th>
                  <th className="th">Jatuh Tempo</th>
                  <th className="th text-right">Total</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((inv) => {
                  const unpaid = ["unpaid", "pending"].includes((inv.status || "").toLowerCase());
                  return (
                    <tr key={String(inv.id)} className="hover:bg-slate-50/60 transition">
                      <td className="td font-mono font-semibold">{inv.code}</td>
                      <td className="td">{periodLabel(inv.period)}</td>
                      <td className="td">{dateID(inv.due_date)}</td>
                      <td className="td text-right font-bold text-slate-900">{idr(invoiceTotal(inv))}</td>
                      <td className="td"><StatusBadge status={inv.status} /></td>
                      <td className="td text-right">
                        {unpaid ? (
                          <Link href={`/portal/bayar/${inv.id}`} className="btn-primary !py-1.5 !px-3.5 !text-xs">
                            Bayar
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">{inv.paid_at ? dateID(inv.paid_at) : "-"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
