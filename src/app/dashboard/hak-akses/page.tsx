"use client";

import { useState } from "react";
import { ErrorBox, PageHeader, Select, Skeleton } from "@/components/admin";
import { api, useApi } from "@/lib/api";

export default function HakAksesPage() {
  const perms = useApi<any>("/api/roles/permissions");
  const [role, setRole] = useState("admin");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const data = perms.data ?? {};
  const menus: { key: string; label: string }[] = data.menus ?? [];
  const roles: string[] = data.roles ?? [];
  const matrix: Record<string, Record<string, boolean>> = data.matrix ?? {};
  const current: Record<string, boolean> = matrix[role] ?? {};

  async function toggle(menuKey: string, allowed: boolean) {
    setBusy(menuKey); setErr(null);
    try {
      await api("/api/roles/permissions", {
        method: "PUT",
        body: JSON.stringify({ role, menu_key: menuKey, allowed }),
      });
      perms.reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }

  const allowedCount = menus.filter((m) => current[m.key] !== false).length;

  return (
    <div>
      <PageHeader
        title="Hak Akses"
        subtitle="Atur menu dashboard yang boleh dibuka setiap peran (hanya superadmin)"
        actions={
          <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-48">
            {roles.map((r) => (
              <option key={r} value={r} className="capitalize">{r}</option>
            ))}
          </Select>
        }
      />

      {perms.error && <div className="mb-4"><ErrorBox message={perms.error} onRetry={perms.reload} /></div>}
      {err && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {perms.loading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold capitalize text-slate-900">Peran: {role}</h3>
              <p className="text-xs text-slate-400">
                {role === "superadmin"
                  ? "Superadmin selalu memiliki akses penuh ke semua menu."
                  : `${allowedCount} dari ${menus.length} menu diizinkan`}
              </p>
            </div>
          </div>
          <ul className="divide-y divide-slate-50">
            {menus.map((m) => {
              const allowed = role === "superadmin" ? true : current[m.key] !== false;
              const loading = busy === m.key;
              return (
                <li key={m.key} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{m.label}</p>
                    <p className="font-mono text-[11px] text-slate-400">{m.key}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={allowed}
                    disabled={role === "superadmin" || loading}
                    onClick={() => toggle(m.key, !allowed)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
                      allowed ? "bg-brand-500" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        allowed ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-slate-400">
            Menu yang tidak dicentang tidak akan tampil di sidebar dan tidak bisa dibuka via URL
            (dialihkan ke dashboard). Jika tabel hak akses kosong, semua menu diizinkan.
          </p>
        </div>
      )}
    </div>
  );
}
