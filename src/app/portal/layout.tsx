import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LogoutButton, PortalNav } from "@/components/public";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between">
            <Link href="/portal" className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white font-extrabold flex items-center justify-center text-lg shadow-soft">
                G
              </span>
              <div>
                <p className="font-extrabold tracking-tight text-slate-900 leading-none">Portal Member</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Halo, {session?.name ?? "Pelanggan"}</p>
              </div>
            </Link>
            <LogoutButton />
          </div>
          <div className="pb-3">
            <PortalNav />
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
      <footer className="border-t border-slate-100 bg-white">
        <p className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-slate-400">
          Butuh bantuan? Hubungi layanan pelanggan kami.
        </p>
      </footer>
    </div>
  );
}
