"use client";

import { useRef, useState } from "react";
import { ConfirmDialog, Field, PageHeader } from "@/components/admin";
import { api } from "@/lib/api";

function downloadJson(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function SistemPage() {
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function doBackup() {
    setBacking(true); setMsg(null);
    try {
      const data = await api<any>("/api/system/backup");
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      downloadJson(`genisp-backup-${stamp}.json`, data);
      setMsg({ ok: true, text: "Backup berhasil diunduh." });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally { setBacking(false); }
  }

  async function doRestore() {
    if (!file) return;
    setRestoring(true); setMsg(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed?.data || typeof parsed.data !== "object") throw new Error("File bukan backup GenISP yang valid.");
      const res = await api<any>("/api/system/restore", {
        method: "POST",
        body: JSON.stringify({ data: parsed.data }),
      });
      const n = Object.values(res.restored ?? {}).reduce((a: number, b: any) => a + Number(b ?? 0), 0);
      setMsg({ ok: true, text: `Restore selesai: ${n} baris dari ${Object.keys(res.restored ?? {}).length} tabel.` });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setRestoring(false);
      setConfirmRestore(false);
    }
  }

  return (
    <div>
      <PageHeader title="Sistem" subtitle="Backup, restore, dan informasi aplikasi (hanya superadmin)" />

      {msg && (
        <p className={`mb-4 rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Backup */}
        <div className="card">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Backup Database</h3>
          <p className="mb-4 text-xs text-slate-400">
            Unduh seluruh data tabel utama sebagai file JSON. Password staff tidak ikut dibackup
            (demi keamanan, akun staff perlu dibuat ulang setelah restore).
          </p>
          <button type="button" className="btn-primary" onClick={doBackup} disabled={backing}>
            {backing ? "Menyiapkan..." : "⬇ Unduh Backup JSON"}
          </button>
        </div>

        {/* Restore */}
        <div className="card">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Restore Database</h3>
          <p className="mb-4 text-xs text-slate-400">
            Pulihkan data dari file backup JSON. <b className="text-red-600">Data tabel yang ada akan dihapus
            dan diganti isi file.</b> Hanya tabel yang dikenal yang diproses.
          </p>
          <Field label="File backup (.json)">
            <input ref={inputRef} type="file" accept="application/json,.json" className="input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          <button type="button" className="btn-danger mt-3" disabled={!file || restoring}
            onClick={() => setConfirmRestore(true)}>
            {restoring ? "Memulihkan..." : "Restore dari File"}
          </button>
        </div>

        {/* Info */}
        <div className="card lg:col-span-2">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Informasi Aplikasi</h3>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["Aplikasi", "GenISP"],
              ["Versi", "1.0"],
              ["Framework", "Next.js 14 + TypeScript"],
              ["Database", "PostgreSQL (Supabase)"],
              ["Auth", "JWT httpOnly cookie"],
              ["Cron", "Vercel Cron (3 jadwal)"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        onConfirm={doRestore}
        loading={restoring}
        danger
        title="Restore Database?"
        confirmLabel="Ya, restore sekarang"
        message={<>File <b>{file?.name}</b> akan <b>menggantikan</b> seluruh data saat ini. Lanjutkan?</>}
      />
    </div>
  );
}
