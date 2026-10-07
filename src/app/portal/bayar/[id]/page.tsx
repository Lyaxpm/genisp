import Link from "next/link";
import { cookies } from "next/headers";
import {
  BayarPanel,
  StatusBadge,
  asInvoices,
  dateID,
  idr,
  invoiceTotal,
  periodLabel,
  type Invoice,
} from "@/components/public";

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, {
      headers: { Cookie: cookies().toString() },
      cache: "no-store",
    });
    const j = await res.json().catch(() => null);
    return j && j.ok ? (j.data as T) : null;
  } catch {
    return null;
  }
}

export default async function PortalBayarPage({ params }: { params: { id: string } }) {
  const [invoiceData, siteData] = await Promise.all([
    apiGet<unknown>("/api/portal/invoices"),
    apiGet<{ company?: { phone?: string } }>("/api/public/site"),
  ]);

  const invoice: Invoice | null =
    asInvoices(invoiceData).find((i) => String(i.id) === String(params.id)) ?? null;
  const waNumber = siteData?.company?.phone;

  if (!invoice) {
    return (
      <div className="card max-w-lg mx-auto text-center py-12 animate-fade-up">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Invoice tidak ditemukan</h2>
        <p className="text-sm text-slate-500 mb-6">Invoice ini bukan milik akun Anda atau sudah tidak tersedia.</p>
        <Link href="/portal/tagihan" className="btn-primary">Kembali ke Tagihan</Link>
      </div>
    );
  }

  const paid = ["paid", "lunas"].includes((invoice.status || "").toLowerCase());

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="animate-fade-up">
        <Link href="/portal/tagihan" className="text-sm font-medium text-slate-500 hover:text-brand-600 transition">
          ← Kembali ke riwayat tagihan
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-2">Bayar Tagihan</h1>
      </div>

      <div className="card animate-fade-up" style={{ animationDelay: "80ms" }}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Kode Invoice</p>
            <p className="font-mono font-bold text-slate-900 text-lg">{invoice.code}</p>
          </div>
          <StatusBadge status={invoice.status} />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm border-t border-slate-100 pt-4">
          <div>
            <dt className="text-xs text-slate-400">Periode</dt>
            <dd className="font-semibold text-slate-800">{periodLabel(invoice.period)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Jatuh Tempo</dt>
            <dd className="font-semibold text-slate-800">{dateID(invoice.due_date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Tagihan</dt>
            <dd className="font-semibold text-slate-800">{idr(invoice.amount)}</dd>
          </div>
          {Number(invoice.unique_amount ?? 0) > 0 && (
            <div>
              <dt className="text-xs text-slate-400">Kode Unik</dt>
              <dd className="font-semibold text-slate-800">{idr(invoice.unique_amount)}</dd>
            </div>
          )}
        </dl>
        <div className="mt-4 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-brand-700">Total Bayar</span>
          <span className="text-2xl font-extrabold text-brand-600">{idr(invoiceTotal(invoice))}</span>
        </div>
      </div>

      {!paid && (
        <BayarPanel invoice={invoice} waNumber={waNumber} confirmBase="/konfirmasi" />
      )}
      {paid && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 animate-fade-in">
          Invoice ini sudah lunas. Terima kasih!
        </p>
      )}
    </div>
  );
}
