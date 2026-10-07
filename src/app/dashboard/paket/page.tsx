"use client";

import { useState } from "react";
import {
  ConfirmDialog, DataTable, Field, FormError, Icon,
  Modal, PageHeader, RowBtn, SearchInput, Select, StatusBadge,
} from "@/components/admin";
import { api, asList, useApi } from "@/lib/api";
import { rupiah } from "@/lib/utils";

const EMPTY = { name: "", category: "rumahan", price: "", speed_down: "", speed_up: "", description: "", is_active: true };

export default function PaketPage() {
  const q = useApi<any>("/api/packages");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "form">(null);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [editId, setEditId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<any>(null);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const list = asList(q.data).filter((p: any) =>
    String(p.name ?? "").toLowerCase().includes(search.trim().toLowerCase()));

  function openAdd() { setForm({ ...EMPTY }); setEditId(null); setErr(null); setModal("form"); }
  function openEdit(p: any) {
    setForm({
      name: p.name ?? "", category: p.category ?? "rumahan",
      price: String(p.price ?? ""), speed_down: p.speed_down ?? p.download ?? "",
      speed_up: p.speed_up ?? p.upload ?? "", description: p.description ?? "",
      is_active: p.is_active ?? p.active ?? true,
    });
    setEditId(p.id); setErr(null); setModal("form");
  }

  async function save() {
    if (!form.name.trim()) { setErr("Nama paket wajib diisi."); return; }
    setSaving(true); setErr(null);
    try {
      const payload = { ...form, price: Number(form.price) || 0 };
      if (editId) await api(`/api/packages/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/api/packages", { method: "POST", body: JSON.stringify(payload) });
      setModal(null); q.reload();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  async function remove() {
    if (!del) return;
    try { await api(`/api/packages/${del.id}`, { method: "DELETE" }); setDel(null); q.reload(); }
    catch (e: any) { alert(e.message); }
  }

  return (
    <div>
      <PageHeader
        title="Paket Internet"
        subtitle={`${list.length} paket tersedia`}
        actions={
          <button type="button" className="btn-primary" onClick={openAdd}>
            <Icon name="plus" className="h-4 w-4" /> Tambah Paket
          </button>
        }
      />

      <div className="mb-4 max-w-md">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari paket..." />
      </div>

      <DataTable
        loading={q.loading} rows={list} emptyText="Belum ada paket"
        rowKey={(r: any) => String(r.id)}
        columns={[
          {
            key: "name", label: "Paket",
            render: (r: any) => (
              <div>
                <p className="font-semibold text-slate-900">{r.name}</p>
                <p className="text-xs capitalize text-slate-400">{r.category ?? "-"}</p>
              </div>
            ),
          },
          {
            key: "speed", label: "Kecepatan",
            render: (r: any) => (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                <Icon name="zap" className="h-3.5 w-3.5 text-orange-500" />
                {r.speed_down ?? r.download ?? "?"} / {r.speed_up ?? r.upload ?? "?"} Mbps
              </span>
            ),
          },
          { key: "price", label: "Harga", className: "text-right", render: (r: any) => <span className="font-bold text-brand-700">{rupiah(r.price ?? 0)}</span> },
          { key: "status", label: "Status", render: (r: any) => <StatusBadge status={(r.is_active ?? r.active ?? true) ? "aktif" : "nonaktif"} /> },
        ]}
        actions={(r: any) => (
          <>
            <RowBtn title="Ubah" icon="pencil" onClick={() => openEdit(r)} />
            <RowBtn title="Hapus" icon="trash" tone="red" onClick={() => setDel(r)} />
          </>
        )}
      />

      <Modal open={modal === "form"} onClose={() => setModal(null)}
        title={editId ? "Ubah Paket" : "Tambah Paket"}>
        <FormError message={err} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama Paket" className="sm:col-span-2">
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="cth: Home 20 Mbps" />
          </Field>
          <Field label="Kategori">
            <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option value="rumahan">Rumahan</option>
              <option value="bisnis">Bisnis</option>
              <option value="hotspot">Hotspot</option>
              <option value="dedicated">Dedicated</option>
            </Select>
          </Field>
          <Field label="Harga / bulan (Rp)">
            <input className="input" type="number" min={0} value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="150000" />
          </Field>
          <Field label="Download (Mbps)">
            <input className="input" value={form.speed_down} onChange={(e) => set("speed_down", e.target.value)} placeholder="20" />
          </Field>
          <Field label="Upload (Mbps)">
            <input className="input" value={form.speed_up} onChange={(e) => set("speed_up", e.target.value)} placeholder="10" />
          </Field>
          <Field label="Deskripsi" className="sm:col-span-2">
            <textarea className="input" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Keterangan paket..." />
          </Field>
          <label className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 rounded accent-brand-600"
              checked={!!form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            <span className="text-sm font-medium text-slate-700">Paket aktif & bisa dipilih pelanggan</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setModal(null)}>Batal</button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger
        title="Hapus Paket" confirmLabel="Ya, hapus"
        message={<>Hapus paket <b>{del?.name}</b>?</>} />
    </div>
  );
}
