import Link from "next/link";
import {
  BayarPanel,
  PublicShell,
  StatusBadge,
  asInvoices,
  dateID,
  idr,
  invoiceTotal,
  periodLabel,
  type Company,
  type Invoice,
} from "@/components/public";

async function getCompany(): Promise<Company> {
  try {
    const res = await fetch("/api/public/site", { cache: "no-store" });
    const j = await res.json();
    return { name: "GenISP", ...(j.ok && j.data?.company ? j.data.company : {}) };
  } catch {
    return { name: "GenISP" };
  }
}

async function getInvoice(code: string): Promise<{ invoice: Invoice | null; customerName?: string }> {
  try {
    const res = await fetch(`/api/public/check-bill?code=${encodeURIComponent(code)}`, { cache: "no-store" });
    if (!res.ok) return { invoice: null };
    const j = await res.json();
    if (!j.ok || !j.data) return { invoice: null };
    const d = j.data as Record<string, unknown>;
    const invoice =
      (d.invoice as Invoice | undefined) ??
      asInvoices(d).find((i) => i.code === code) ??
      asInvoices(d)[0] ??
      null;
    const customer = d.customer as { name?: string } | undefined;
    return { invoice, customerName: customer?.name ?? (invoice as Invoice | null)?.customer_name };
  } catch {
    return { invoice: null };
  }
}

export default async function BayarPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code);
  const [company, { invoice, customerName }] = await Promise.all([getCompany(), getInvoice(code)]);

  if (!invoice) {
    return (
      <PublicShell company={company} eyebrow="Pembayaran" title="Invoice tidak ditemukan">
        <div className="card max-w-lg mx-auto text-center py-12 animate-fade-up">
          <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Kode invoice tidak valid</h2>
          <p className="text-sm text-slate-500 mb-6">
            Invoice <span className="font-mono">{code}</span> tidak ditemukan atau sudah tidak berlaku.
          </p>
          <div className="flex justify-center gap-2">
            <a href="/#cek-tagihan" className="btn-outline">Cek Tagihan</a>
            <Link href="/" className="btn-primary">Beranda</Link>
          </div>
        </div>
      </PublicShell>
    );
  }

  const paid = ["paid", "lunas"].includes((invoice.status || "").toLowerCase());

  return (
    <PublicShell
      company={company}
      eyebrow="Pembayaran"
      title="Bayar Tagihan"
      desc="Pilih metode pembayaran yang paling nyaman untuk Anda."
    >
      <div className="max-w-2xl mx-auto space-y-5">
        {/* ringkasan invoice */}
        <div className="card animate-fade-up">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Kode Invoice</p>
              <p className="font-mono font-bold text-slate-900 text-lg">{invoice.code}</p>
              {(customerName || invoice.customer_name) && (
                <p className="text-sm text-slate-500 mt-0.5">{customerName ?? invoice.customer_name}</p>
              )}
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
          {paid && (
            <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              Invoice ini sudah lunas{invoice.paid_at ? ` pada ${dateID(invoice.paid_at)}` : ""}. Terima kasih!
            </p>
          )}
        </div>

        {!paid && (
          <BayarPanel invoice={invoice} waNumber={company.phone} confirmBase="/konfirmasi" />
        )}
      </div>
    </PublicShell>
  );
}
