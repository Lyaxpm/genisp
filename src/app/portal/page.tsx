import Link from "next/link";
import { cookies } from "next/headers";
import { StatusBadge } from "@/components/public";
import ResetConnection from "@/components/ResetConnection";
import {
  asInvoices,
  dateID,
  idr,
  invoiceTotal,
  periodLabel,
  type Customer,
  type Invoice,
} from "@/lib/public-types";

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

function asCustomer(d: unknown): Customer | null {
  if (!d) return null;
  if (Array.isArray(d)) return null;
  const o = d as Record<string, unknown>;
  if (o.customer) return o.customer as Customer;
  if (typeof o.name === "string") return o as unknown as Customer;
  return null;
}

export default async function PortalHome() {
  const [profileData, invoiceData] = await Promise.all([
    apiGet<unknown>("/api/portal/profile"),
    apiGet<unknown>("/api/portal/invoices"),
  ]);

  const customer = asCustomer(profileData);
  const invoices = asInvoices(invoiceData);
  const unpaid = invoices.filter((i) => ["unpaid", "pending"].includes((i.status || "").toLowerCase()));
  const totalUnpaid = unpaid.reduce((s, i) => s + invoiceTotal(i), 0);

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Halo, {customer?.name ?? "Pelanggan"} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-1">Kelola layanan internet dan tagihan Anda di sini.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* status layanan */}
        <div className="card animate-fade-up" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">Status Layanan</h2>
            <StatusBadge status={customer?.status ?? "aktif"} />
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">ID Pelanggan</dt>
              <dd className="font-mono font-semibold text-slate-800">{customer?.code ?? "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Paket</dt>
              <dd className="font-semibold text-slate-800">{customer?.package_name ?? "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Jatuh Tempo Tiap Tgl</dt>
              <dd className="font-semibold text-slate-800">{customer?.due_day ?? "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">No. HP</dt>
              <dd className="font-semibold text-slate-800">{customer?.phone ?? "-"}</dd>
            </div>
          </dl>
        </div>

        {/* ringkasan tagihan */}
        <div className="card animate-fade-up bg-gradient-to-br from-brand-700 to-brand-500 !border-0" style={{ animationDelay: "160ms" }}>
          <h2 className="font-bold text-white mb-1">Tagihan Belum Bayar</h2>
          <p className="text-3xl font-extrabold text-white mt-2">{idr(totalUnpaid)}</p>
          <p className="text-sm text-white/70 mt-1">
            {unpaid.length === 0 ? "Semua tagihan sudah lunas. 🎉" : `${unpaid.length} invoice menunggu pembayaran`}
          </p>
          {unpaid.length > 0 && (
            <Link href="/portal/tagihan" className="btn bg-white text-brand-700 hover:bg-brand-50 font-bold mt-5">
              Lihat & Bayar
            </Link>
          )}
        </div>
      </div>

      {/* reset koneksi */}
      <ResetConnection />

      {/* daftar tagihan belum bayar */}
      <div className="card animate-fade-up" style={{ animationDelay: "220ms" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900">Perlu Dibayar</h2>
          <Link href="/portal/tagihan" className="text-sm font-semibold text-brand-600 hover:underline">
            Riwayat lengkap →
          </Link>
        </div>
        {unpaid.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">Tidak ada tagihan yang belum dibayar.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {unpaid.map((inv: Invoice) => (
              <li key={String(inv.id)} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-900">{inv.code}</p>
                  <p className="text-xs text-slate-500">
                    Periode {periodLabel(inv.period)} · Jatuh tempo {dateID(inv.due_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-extrabold text-brand-600">{idr(invoiceTotal(inv))}</p>
                  <Link href={`/portal/bayar/${inv.id}`} className="btn-primary !py-2">Bayar</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
