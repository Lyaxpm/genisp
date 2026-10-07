"use client";

import React, { useEffect, useState } from "react";

/* ============================ ICONS ============================ */

const PATHS: Record<string, React.ReactNode> = {
  grid: (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  users: (<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  receipt: (<><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" /></>),
  box: (<><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>),
  router: (<><rect x="2" y="13" width="20" height="7" rx="2" /><path d="M6 13V9a6 6 0 0 1 12 0v4" /><circle cx="12" cy="16.5" r="0.5" /></>),
  ticket: (<><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" /></>),
  network: (<><rect x="9" y="2" width="6" height="6" rx="1" /><rect x="2" y="16" width="6" height="6" rx="1" /><rect x="16" y="16" width="6" height="6" rx="1" /><path d="M12 8v4m0 0-7 4m7-4 7 4" /></>),
  wallet: (<><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16V12" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></>),
  badgeCheck: (<><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></>),
  chart: (<><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M7 13v4" /><path d="M12 9v8" /><path d="M17 5v12" /></>),
  cog: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>),
  userCog: (<><circle cx="10" cy="8" r="4" /><path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 4.4 2.6" /><circle cx="18" cy="18" r="3" /><path d="M18 15.5v1.5l1 1" /></>),
  plus: (<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>),
  x: (<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>),
  menu: (<><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>),
  logout: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>),
  printer: (<><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>),
  copy: (<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>),
  check: (<><path d="M20 6 9 17l-5-5" /></>),
  trash: (<><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>),
  pencil: (<><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></>),
  eye: (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>),
  refresh: (<><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></>),
  download: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>),
  mapPin: (<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>),
  calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></>),
  alert: (<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>),
  info: (<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>),
  zap: (<><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></>),
  clock: (<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>),
  wifi: (<><path d="M5 13a10 10 0 0 1 14 0" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M2 8.82a15 15 0 0 1 20 0" /><path d="M12 20h.01" /></>),
  server: (<><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><path d="M6 6h.01" /><path d="M6 18h.01" /></>),
  fileText: (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></>),
  arrowLeft: (<><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>),
  building: (<><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M8 10h.01" /><path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 14h.01" /><path d="M16 14h.01" /><path d="M12 14h.01" /></>),
  key: (<><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" /></>),
  external: (<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></>),
  filter: (<><path d="M22 3H2l8 9.46V19l4 2v-8.54Z" /></>),
  inbox: (<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></>),
};

export function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name] ?? PATHS.info}
    </svg>
  );
}

/* ============================ STAT ============================ */

export function Stat({ label, value, sub, icon, accent }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon: string; accent?: string;
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${accent ?? "bg-brand-50 text-brand-600"}`}>
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 truncate text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

/* ============================ DATA TABLE ============================ */

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T>({ columns, rows, actions, loading, emptyText, rowKey }: {
  columns: Column<T>[];
  rows: T[];
  actions?: (row: T) => React.ReactNode;
  loading?: boolean;
  emptyText?: string;
  rowKey?: (row: T, i: number) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-card">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50/80">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`th ${c.className ?? ""}`}>{c.label}</th>
            ))}
            {actions && <th className="th text-right">Aksi</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key} className="td"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                ))}
                {actions && <td className="td"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-12 text-center">
                <div className="mx-auto flex max-w-xs flex-col items-center gap-2 text-slate-400">
                  <Icon name="inbox" className="h-10 w-10 text-slate-200" />
                  <p className="text-sm font-medium">{emptyText ?? "Belum ada data"}</p>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={rowKey ? rowKey(row, i) : i} className="transition hover:bg-slate-50/60">
                {columns.map((c) => (
                  <td key={c.key} className={`td ${c.className ?? ""}`}>
                    {c.render ? c.render(row) : (row as any)[c.key]}
                  </td>
                ))}
                {actions && (
                  <td className="td">
                    <div className="flex items-center justify-end gap-1.5">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Tombol aksi kecil di tabel */
export function RowBtn({ title, onClick, icon, tone = "slate" }: {
  title: string; onClick: () => void; icon: string; tone?: "slate" | "red" | "green" | "brand" | "amber";
}) {
  const tones: Record<string, string> = {
    slate: "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
    red: "text-red-500 hover:bg-red-50 hover:text-red-600",
    green: "text-green-600 hover:bg-green-50",
    brand: "text-brand-600 hover:bg-brand-50",
    amber: "text-amber-600 hover:bg-amber-50",
  };
  return (
    <button type="button" title={title} onClick={onClick}
      className={`rounded-lg p-2 transition ${tones[tone]}`}>
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

/* ============================ MODAL ============================ */

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", fn);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative flex max-h-[90vh] w-full ${wide ? "max-w-3xl" : "max-w-lg"} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Tutup"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ============================ CONFIRM DIALOG ============================ */

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, danger, loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${danger ? "bg-red-100 text-red-600" : "bg-brand-50 text-brand-600"}`}>
          <Icon name={danger ? "alert" : "info"} className="h-6 w-6" />
        </div>
        <div className="text-sm text-slate-600">{message}</div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-outline" onClick={onClose} disabled={loading}>Batal</button>
        <button type="button" className={danger ? "btn-danger" : "btn-primary"} onClick={onConfirm} disabled={loading}>
          {loading ? "Memproses..." : (confirmLabel ?? "Ya, lanjutkan")}
        </button>
      </div>
    </Modal>
  );
}

/* ============================ STATUS BADGE ============================ */

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-green-100 text-green-700", lunas: "bg-green-100 text-green-700",
  active: "bg-green-100 text-green-700", aktif: "bg-green-100 text-green-700",
  success: "bg-green-100 text-green-700", disetujui: "bg-green-100 text-green-700",
  isolir: "bg-red-100 text-red-700", failed: "bg-red-100 text-red-700",
  gagal: "bg-red-100 text-red-700", ditolak: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-800", menunggu: "bg-yellow-100 text-yellow-800",
  unpaid: "bg-amber-100 text-amber-800", belum_bayar: "bg-amber-100 text-amber-800",
  "belum bayar": "bg-amber-100 text-amber-800",
  nonaktif: "bg-slate-100 text-slate-600", inactive: "bg-slate-100 text-slate-600",
  expired: "bg-slate-100 text-slate-600", kedaluwarsa: "bg-slate-100 text-slate-600",
  draft: "bg-slate-100 text-slate-600",
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Lunas", unpaid: "Belum Bayar", belum_bayar: "Belum Bayar",
  active: "Aktif", aktif: "Aktif", inactive: "Nonaktif", nonaktif: "Nonaktif",
  pending: "Menunggu", isolir: "Isolir", failed: "Gagal", success: "Berhasil",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = String(status ?? "").toLowerCase().trim();
  const cls = STATUS_STYLE[key] ?? "bg-slate-100 text-slate-600";
  const label = STATUS_LABEL[key] ?? (status ? String(status).charAt(0).toUpperCase() + String(status).slice(1) : "-");
  return (
    <span className={`badge ${cls}`}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/* ============================ INPUTS ============================ */

export function SearchInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="relative">
      <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        className="input pl-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Cari..."}
      />
    </div>
  );
}

export function Field({ label, children, hint, className }: {
  label: string; children: React.ReactNode; hint?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return (
    <select className={`input ${className ?? ""}`} {...rest}>
      {children}
    </select>
  );
}

/* ============================ TABS ============================ */

export function Tabs({ tabs, value, onChange }: {
  tabs: { key: string; label: string; icon?: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              active ? "bg-brand-500 text-white shadow-soft" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.icon && <Icon name={t.icon} className="h-4 w-4" />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============================ MISC ============================ */

export function PageHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex items-start gap-3 border-red-100 bg-red-50/60">
      <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-700">Gagal memuat data</p>
        <p className="mt-0.5 text-sm text-red-600/80">{message}</p>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-outline !px-3 !py-1.5 text-xs">
          <Icon name="refresh" className="h-3.5 w-3.5" /> Coba lagi
        </button>
      )}
    </div>
  );
}

export function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title="Salin"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch { /* abaikan */ }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
    >
      <Icon name={done ? "check" : "copy"} className="h-3.5 w-3.5" />
      {done ? "Tersalin!" : (label ?? text)}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
