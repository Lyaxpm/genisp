"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/admin";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getClientLocale, getDictionary, type Dictionary, type Locale } from "@/i18n";
import { api, asList } from "@/lib/api";

type Me = { name?: string; email?: string; role?: string };

const NAV: { href: string; key: keyof Dictionary["nav"]; icon: string; menu: string; adminOnly?: boolean; superOnly?: boolean }[] = [
  { href: "/dashboard", key: "dashboard", icon: "grid", menu: "dashboard" },
  { href: "/dashboard/pelanggan", key: "pelanggan", icon: "users", menu: "pelanggan" },
  { href: "/dashboard/tagihan", key: "tagihan", icon: "receipt", menu: "tagihan" },
  { href: "/dashboard/paket", key: "paket", icon: "box", menu: "paket" },
  { href: "/dashboard/genieacs", key: "genieacs", icon: "wifi", menu: "genieacs" },
  { href: "/dashboard/router", key: "router", icon: "router", menu: "router" },
  { href: "/dashboard/hotspot", key: "hotspot", icon: "wifi", menu: "hotspot" },
  { href: "/dashboard/ftth", key: "ftth", icon: "network", menu: "ftth" },
  { href: "/dashboard/keuangan", key: "keuangan", icon: "chart", menu: "keuangan" },
  { href: "/dashboard/konfirmasi", key: "konfirmasi", icon: "badgeCheck", menu: "konfirmasi" },
  { href: "/dashboard/tiket", key: "tiket", icon: "ticket", menu: "tiket" },
  { href: "/dashboard/gudang", key: "gudang", icon: "building", menu: "gudang" },
  { href: "/dashboard/sales", key: "sales", icon: "zap", menu: "sales" },
  { href: "/dashboard/wallet", key: "wallet", icon: "wallet", menu: "wallet" },
  { href: "/dashboard/laporan", key: "laporan", icon: "fileText", menu: "laporan" },
  { href: "/dashboard/notifikasi", key: "notifikasi", icon: "inbox", menu: "notifikasi" },
  { href: "/dashboard/peta", key: "peta", icon: "mapPin", menu: "peta" },
  { href: "/dashboard/master", key: "master", icon: "server", menu: "master" },
  { href: "/dashboard/pengaturan", key: "pengaturan", icon: "cog", menu: "pengaturan" },
  { href: "/dashboard/hak-akses", key: "hakAkses", icon: "key", menu: "pengaturan", superOnly: true },
  { href: "/dashboard/pengguna", key: "pengguna", icon: "userCog", menu: "pengguna", adminOnly: true },
  { href: "/dashboard/sistem", key: "sistem", icon: "server", menu: "sistem", superOnly: true },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false); // sidebar mobile
  const [me, setMe] = useState<Me | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [permMatrix, setPermMatrix] = useState<Record<string, Record<string, boolean>> | null>(null);
  // Locale dibaca dari window.__LOCALE__ (diset script boot di layout root)
  // agar label nav langsung benar sejak render pertama, tanpa flash.
  const [locale] = useState<Locale>(() => getClientLocale());
  const dict = getDictionary(locale);

  useEffect(() => {
    api<Me>("/api/auth/me").then(setMe).catch(() => {});
    api<any>("/api/confirm-payments?status=pending")
      .then((d) => setPendingCount(asList(d).length))
      .catch(() => {});
    api<any>("/api/roles/permissions")
      .then((d) => setPermMatrix(d?.matrix ?? {}))
      .catch(() => setPermMatrix({}));
  }, []);

  // tutup sidebar mobile saat pindah halaman
  useEffect(() => { setOpen(false); }, [pathname]);

  const role = (me?.role ?? "").toLowerCase();
  const canManageUsers = role === "superadmin" || role === "admin";
  const isSuper = role === "superadmin";
  const visibleNav = NAV.filter((n) => {
    if (n.superOnly && !isSuper) return false;
    if (n.adminOnly && !canManageUsers) return false;
    // RBAC granular: sembunyikan menu yang explicitly denied (kecuali superadmin)
    if (!isSuper && permMatrix?.[role]?.[n.menu] !== true) return false;
    return true;
  });
  const current = [...NAV].reverse().find((n) => isActive(pathname, n.href));
  const tNav = (key: keyof Dictionary["nav"]) => dict.nav[key];

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* abaikan */ }
    router.push("/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-3 px-5 pb-6 pt-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
          <Icon name="zap" className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">GenISP</span>
          <span className="block text-[11px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">Billing Platform</span>
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {visibleNav.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand-500 text-white shadow-soft"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
            >
              <Icon name={n.icon} className={`h-5 w-5 shrink-0 ${active ? "" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"}`} />
              <span className="flex-1">{tNav(n.key)}</span>
              {n.href === "/dashboard/konfirmasi" && pendingCount > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"}`}>
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User mini */}
      <div className="border-t border-slate-100 p-4 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            {(me?.name ?? "A").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{me?.name ?? dict.common.loading}</p>
            <p className="truncate text-xs capitalize text-slate-400 dark:text-slate-500">{me?.role ?? ""}</p>
          </div>
          <button type="button" onClick={logout} title={dict.auth.logout} disabled={loggingOut}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950">
            <Icon name="logout" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-100 bg-white lg:block print:hidden dark:border-slate-800 dark:bg-slate-900">
        {sidebar}
      </aside>

      {/* Sidebar mobile */}
      <div className={`fixed inset-0 z-40 lg:hidden print:hidden ${open ? "" : "pointer-events-none"}`}>
        <div
          className={`absolute inset-0 bg-slate-900/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-72 bg-white shadow-2xl transition-transform duration-300 dark:bg-slate-900 ${open ? "translate-x-0" : "-translate-x-full"}`}
        >
          {sidebar}
        </aside>
      </div>

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/85 backdrop-blur print:hidden dark:border-slate-800 dark:bg-slate-900/85">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button type="button" onClick={() => setOpen(true)} aria-label={dict.common.openMenu}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 lg:hidden dark:border-slate-700 dark:text-slate-300">
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100 sm:text-base">
                {current ? tNav(current.key) : tNav("dashboard")}
              </p>
              <p className="hidden text-xs text-slate-400 dark:text-slate-500 sm:block">{dict.dashboard.topbarSubtitle}</p>
            </div>
            <LanguageSwitcher locale={locale} />
            <ThemeToggle darkLabel={dict.common.darkMode} lightLabel={dict.common.lightMode} />
            <span className="hidden items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 sm:inline-flex dark:bg-brand-950 dark:text-brand-200">
              <span className="h-2 w-2 rounded-full bg-green-500" /> {dict.common.online}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
