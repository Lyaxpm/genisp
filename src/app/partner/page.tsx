import { cookies } from "next/headers";
import { LogoutButton, StatusBadge } from "@/components/public";
import {
  dateID,
  idr,
  type Customer,
  type PartnerInfo,
  type WalletTx,
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

function asPartner(d: unknown): PartnerInfo | null {
  if (!d) return null;
  const o = d as Record<string, unknown>;
  if (o.partner) return o.partner as PartnerInfo;
  if (typeof o.name === "string") return o as unknown as PartnerInfo;
  return null;
}

function asCustomers(d: unknown): Customer[] {
  if (!d) return [];
  if (Array.isArray(d)) return d as Customer[];
  const o = d as Record<string, unknown>;
  if (Array.isArray(o.customers)) return o.customers as Customer[];
  return [];
}

function asWalletHistory(d: unknown): WalletTx[] {
  if (!d) return [];
  const o = d as Record<string, unknown>;
  for (const k of ["wallet_history", "transactions", "history"]) {
    if (Array.isArray(o[k])) return o[k] as WalletTx[];
  }
  return [];
}

export default async function PartnerPage() {
  const [meData, custData] = await Promise.all([
    apiGet<unknown>("/api/partner/me"),
    apiGet<unknown>("/api/partner/customers"),
  ]);

  const partner = asPartner(meData);
  const customers = asCustomers(custData);
  const history = asWalletHistory(meData);
  const balance = Number(partner?.wallet_balance ?? 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white font-extrabold flex items-center justify-center text-lg shadow-soft">
              G
            </span>
            <div>
              <p className="font-extrabold tracking-tight text-slate-900 leading-none">Portal Partner</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Halo, {partner?.name ?? "Partner"}</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="animate-fade-up">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard Partner</h1>
          <p className="text-sm text-slate-500 mt-1">Pantau saldo komisi dan pelanggan di bawah jaringan Anda.</p>
        </div>

        {/* saldo + statistik */}
        <div className="grid sm:grid-cols-3 gap-5">
          <div className="card animate-fade-up bg-gradient-to-br from-brand-700 to-brand-500 !border-0 sm:col-span-1" style={{ animationDelay: "60ms" }}>
            <p className="text-xs uppercase tracking-widest text-white/60 font-semibold mb-1">Saldo Wallet</p>
            <p className="text-3xl font-extrabold text-white">{idr(balance)}</p>
            <p className="text-xs text-white/60 mt-2">Komisi otomatis masuk setiap pembayaran pelanggan terverifikasi.</p>
          </div>
          <div className="card animate-fade-up text-center flex flex-col justify-center" style={{ animationDelay: "120ms" }}>
            <p className="text-3xl font-extrabold text-slate-900">{customers.length}</p>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide font-semibold">Total Pelanggan</p>
          </div>
          <div className="card animate-fade-up text-center flex flex-col justify-center" style={{ animationDelay: "180ms" }}>
            <p className="text-3xl font-extrabold text-slate-900">{Number(partner?.commission_percent ?? 0)}%</p>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide font-semibold">Komisi Anda</p>
          </div>
        </div>

        {/* daftar pelanggan */}
        <div className="card !p-0 overflow-hidden animate-fade-up" style={{ animationDelay: "240ms" }}>
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">Pelanggan Saya</h2>
          </div>
          {customers.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">Belum ada pelanggan terdaftar di bawah Anda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="th">ID</th>
                    <th className="th">Nama</th>
                    <th className="th">No. HP</th>
                    <th className="th">Paket</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((c) => (
                    <tr key={String(c.id)} className="hover:bg-slate-50/60 transition">
                      <td className="td font-mono font-semibold">{c.code ?? "-"}</td>
                      <td className="td font-medium text-slate-900">{c.name}</td>
                      <td className="td">{c.phone ?? "-"}</td>
                      <td className="td">{c.package_name ?? "-"}</td>
                      <td className="td"><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* riwayat wallet */}
        <div className="card animate-fade-up" style={{ animationDelay: "300ms" }}>
          <h2 className="font-bold text-slate-900 mb-4">Riwayat Wallet</h2>
          {history.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Belum ada riwayat transaksi wallet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.map((t) => {
                const credit = (t.type || "").toLowerCase() === "credit";
                return (
                  <li key={String(t.id)} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                        credit ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" : "bg-red-50 text-red-600 ring-1 ring-red-200"
                      }`}>
                        {credit ? "+" : "−"}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{t.description || (credit ? "Komisi masuk" : "Penarikan")}</p>
                        <p className="text-xs text-slate-400">{dateID(t.created_at)}</p>
                      </div>
                    </div>
                    <p className={`font-extrabold ${credit ? "text-emerald-600" : "text-red-500"}`}>
                      {credit ? "+" : "−"}{idr(t.amount)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-100 bg-white">
        <p className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Portal Partner
        </p>
      </footer>
    </div>
  );
}
