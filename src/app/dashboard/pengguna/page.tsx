"use client";

import { useState } from "react";
import {
  ConfirmDialog, DataTable, ErrorBox, Field, FormError, Icon,
  Modal, PageHeader, RowBtn, Select, StatusBadge,
} from "@/components/admin";
import { api, asList, useApi } from "@/lib/api";

const EMPTY = { name: "", email: "", password: "", role: "kasir", is_active: true };

export default function PenggunaPage() {
  const me = useApi<any>("/api/auth/me");
  const q = useApi<any>("/api/users");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [editId, setEditId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<any>(null);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const role = String(me.data?.role ?? "").toLowerCase();
  const allowed = role === "superadmin" || role === "admin";
  const list = asList(q.data);

  function openAdd() { setForm({ ...EMPTY }); setEditId(null); setErr(null); setModal(true); }
  function openEdit(u: any) {
    setForm({ name: u.name ?? "", email: u.email ?? "", password: "", role: u.role ?? "kasir", is_active: u.is_active ?? u.active ?? true });
    setEditId(u.id); setErr(null); setModal(true);
  }

  async function save() {
    if (!form.name.trim() || !form.email.trim()) { setErr("Nama dan email wajib diisi."); return; }
    if (!editId && !form.password) { setErr("Password wajib diisi untuk pengguna baru."); return; }
    setSaving(true); setErr(null);
    try {
      const payload: any = { name: form.name, email: form.email, role: form.role, is_active: form.is_active };
      if (form.password) payload.password = form.password;
      if (editId) await api(`/api/users/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/api/users", { method: "POST", body: JSON.stringify(payload) });
      setModal(false); q.reload();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  async function remove() {
    if (!del) return;
    try { await api(`/api/users/${del.id}`, { method: "DELETE" }); setDel(null); q.reload(); }
    catch (e: any) { alert(e.message); }
  }

  if (!me.loading && !allowed) {
    return (
      <div className="card mx-auto mt-10 max-w-md text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <Icon name="alert" className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Akses Ditolak</h1>
        <p className="mt-1 text-sm text-slate-500">
          Halaman ini hanya dapat diakses oleh Superadmin atau Admin.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Pengguna"
        subtitle={`${list.length} akun staff terdaftar`}
        actions={
          <button type="button" className="btn-primary" onClick={openAdd}>
            <Icon name="plus" className="h-4 w-4" /> Tambah Pengguna
          </button>
        }
      />

      {q.error && <div className="mb-4"><ErrorBox message={q.error} onRetry={q.reload} /></div>}

      <DataTable
        loading={q.loading} rows={list} emptyText="Belum ada pengguna"
        rowKey={(r: any) => String(r.id)}
        columns={[
          {
            key: "name", label: "Nama",
            render: (r: any) => (
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {String(r.name ?? "A").charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-400">{r.email}</p>
                </div>
              </div>
            ),
          },
          {
            key: "role", label: "Role",
            render: (r: any) => (
              <span className={`badge ${String(r.role).toLowerCase() === "superadmin" ? "bg-orange-100 text-orange-700" : "bg-brand-50 text-brand-700"}`}>
                {String(r.role ?? "-").toUpperCase()}
              </span>
            ),
          },
          { key: "status", label: "Status", render: (r: any) => <StatusBadge status={(r.is_active ?? r.active ?? true) ? "aktif" : "nonaktif"} /> },
        ]}
        actions={(r: any) => (
          <>
            <RowBtn title="Ubah" icon="pencil" onClick={() => openEdit(r)} />
            <RowBtn title="Hapus" icon="trash" tone="red" onClick={() => setDel(r)} />
          </>
        )}
      />

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "Ubah Pengguna" : "Tambah Pengguna"}>
        <FormError message={err} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama Lengkap">
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nama staff" />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="staff@genisp.id" />
          </Field>
          <Field label={editId ? "Password Baru (kosongkan jika tidak diubah)" : "Password"}>
            <input className="input" type="password" value={form.password}
              onChange={(e) => set("password", e.target.value)} placeholder="••••••" autoComplete="new-password" />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => set("role", e.target.value)}>
              <option value="superadmin">Superadmin</option>
              <option value="admin">Admin</option>
              <option value="kasir">Kasir</option>
              <option value="teknisi">Teknisi</option>
            </Select>
          </Field>
          <label className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 rounded accent-brand-600"
              checked={!!form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            <span className="text-sm font-medium text-slate-700">Akun aktif (bisa login)</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setModal(false)}>Batal</button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger
        title="Hapus Pengguna" confirmLabel="Ya, hapus"
        message={<>Hapus akun <b>{del?.name}</b> ({del?.email})?</>} />
    </div>
  );
}
