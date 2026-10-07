"use client";

import { useMemo, useState } from "react";
import {
  ConfirmDialog, DataTable, ErrorBox, Field, FormError, Icon,
  Modal, PageHeader, RowBtn, SearchInput, Select, StatusBadge,
} from "@/components/admin";
import { api, asList, useApi } from "@/lib/api";
import { rupiah, todayID } from "@/lib/utils";

const EMPTY_FORM = {
  name: "", phone: "", email: "", address: "",
  package_id: "", router_id: "", pppoe_username: "", pppoe_password: "",
  connection_type: "PPPoE", due_day: "1", status: "aktif",
};

export default function PelangganPage() {
  const customers = useApi<any>("/api/customers");
  const packages = useApi<any>("/api/packages");
  const routers = useApi<any>("/api/routers");

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("semua");
  const [modal, setModal] = useState<null | "add" | "edit" | "detail">(null);
  const [form, setForm] = useState<any>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [changing, setChanging] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const list = asList(customers.data);
  const pkgList = asList(packages.data);
  const routerList = asList(routers.data);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((c: any) => {
      const st = String(c.status ?? "aktif").toLowerCase();
      if (statusFilter !== "semua" && st !== statusFilter) return false;
      if (!needle) return true;
      return [c.name, c.phone, c.email, c.pppoe_username].some((v) =>
        String(v ?? "").toLowerCase().includes(needle));
    });
  }, [list, q, statusFilter]);

  const detail = useMemo(
    () => list.find((c: any) => String(c.id) === String(detailId)),
    [list, detailId]
  );
  const detailInvoices = useApi<any>(detailId ? `/api/invoices?customer_id=${detailId}` : null);
  const pkgName = (id: any) => pkgList.find((p: any) => String(p.id) === String(id))?.name ?? "-";

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setEditingId(null);
    setModal("add");
  }
  function openEdit(c: any) {
    setForm({
      name: c.name ?? "", phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "",
      package_id: c.package_id ?? "", router_id: c.router_id ?? "",
      pppoe_username: c.pppoe_username ?? "", pppoe_password: c.pppoe_password ?? "",
      connection_type: c.connection_type ?? "PPPoE", due_day: String(c.due_day ?? "1"),
      status: c.status ?? "aktif",
    });
    setFormError(null);
    setEditingId(c.id);
    setModal("edit");
  }
  function openDetail(c: any) {
    setDetailId(c.id);
    setModal("detail");
  }

  async function save() {
    if (!form.name.trim()) { setFormError("Nama pelanggan wajib diisi."); return; }
    setSaving(true); setFormError(null);
    try {
      const payload = { ...form, due_day: Number(form.due_day) || 1 };
      if (modal === "add") await api("/api/customers", { method: "POST", body: JSON.stringify(payload) });
      else await api(`/api/customers/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      setModal(null);
      customers.reload();
    } catch (e: any) {
      setFormError(e.message);
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!confirmDelete) return;
    setChanging(true);
    try {
      await api(`/api/customers/${confirmDelete.id}`, { method: "DELETE" });
      setConfirmDelete(null);
      customers.reload();
    } catch (e: any) {
      alert(e.message);
    } finally { setChanging(false); }
  }

  async function changeStatus(status: string) {
    if (!detailId) return;
    setChanging(true);
    try {
      await api(`/api/customers/${detailId}/status`, { method: "POST", body: JSON.stringify({ status }) });
      customers.reload();
    } catch (e: any) {
      alert(e.message);
    } finally { setChanging(false); }
  }

  async function doImport() {
    const rows = csv
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, phone, email, address, package_id] = line.split(",").map((s) => s.trim());
        return { name, phone, email, address, package_id: package_id || undefined };
      })
      .filter((r) => r.name && r.phone);
    if (!rows.length) {
      setImportResult({ error: "Tidak ada baris valid. Format: nama,telepon,email,alamat,package_id" });
      return;
    }
    setImporting(true);
    try {
      const res = await api<any>("/api/system/import-customers", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      setImportResult(res);
      customers.reload();
    } catch (e: any) {
      setImportResult({ error: e.message });
    } finally {
      setImporting(false);
    }
  }

  const formFields = (
    <>
      <FormError message={formError} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nama Lengkap" className="sm:col-span-2">
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nama pelanggan" />
        </Field>
        <Field label="No. WhatsApp / Telepon">
          <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="08xx..." />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@contoh.id" />
        </Field>
        <Field label="Alamat" className="sm:col-span-2">
          <textarea className="input" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Alamat pemasangan" />
        </Field>
        <Field label="Paket Internet">
          <Select value={form.package_id} onChange={(e) => set("package_id", e.target.value)}>
            <option value="">-- Pilih paket --</option>
            {pkgList.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} — {rupiah(p.price ?? 0)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Router">
          <Select value={form.router_id} onChange={(e) => set("router_id", e.target.value)}>
            <option value="">-- Pilih router --</option>
            {routerList.map((r: any) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Username PPPoE">
          <input className="input" value={form.pppoe_username} onChange={(e) => set("pppoe_username", e.target.value)} placeholder="user123" />
        </Field>
        <Field label="Password PPPoE">
          <input className="input" value={form.pppoe_password} onChange={(e) => set("pppoe_password", e.target.value)} placeholder="••••••" />
        </Field>
        <Field label="Tipe Koneksi">
          <Select value={form.connection_type} onChange={(e) => set("connection_type", e.target.value)}>
            <option>PPPoE</option><option>Hotspot</option><option>FTTH</option><option>Dedicated</option>
          </Select>
        </Field>
        <Field label="Tanggal Jatuh Tempo">
          <input className="input" type="number" min={1} max={31} value={form.due_day} onChange={(e) => set("due_day", e.target.value)} />
        </Field>
        <Field label="Status" className="sm:col-span-2">
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="aktif">Aktif</option>
            <option value="isolir">Isolir</option>
            <option value="nonaktif">Nonaktif</option>
          </Select>
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-outline" onClick={() => setModal(null)}>Batal</button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </>
  );

  return (
    <div>
      <PageHeader
        title="Pelanggan"
        subtitle={`${filtered.length} pelanggan terdaftar`}
        actions={
          <div className="flex gap-2">
            <button type="button" className="btn-outline" onClick={() => { setImportOpen(true); setImportResult(null); }}>
              <Icon name="inbox" className="h-4 w-4" /> Import CSV
            </button>
            <button type="button" className="btn-primary" onClick={openAdd}>
              <Icon name="plus" className="h-4 w-4" /> Tambah Pelanggan
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1"><SearchInput value={q} onChange={setQ} placeholder="Cari nama, telepon, email, username PPPoE..." /></div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-48">
          <option value="semua">Semua status</option>
          <option value="aktif">Aktif</option>
          <option value="isolir">Isolir</option>
          <option value="nonaktif">Nonaktif</option>
        </Select>
      </div>

      {customers.error && <div className="mb-4"><ErrorBox message={customers.error} onRetry={customers.reload} /></div>}

      <DataTable
        loading={customers.loading}
        rows={filtered}
        emptyText={q || statusFilter !== "semua" ? "Tidak ada pelanggan yang cocok" : "Belum ada pelanggan"}
        rowKey={(r: any) => String(r.id)}
        columns={[
          {
            key: "name", label: "Pelanggan",
            render: (r: any) => (
              <div>
                <p className="font-semibold text-slate-900">{r.name}</p>
                <p className="text-xs text-slate-400">{r.phone ?? "-"} {r.email ? `• ${r.email}` : ""}</p>
              </div>
            ),
          },
          { key: "package", label: "Paket", render: (r: any) => r.package_name ?? pkgName(r.package_id) },
          { key: "pppoe", label: "PPPoE", render: (r: any) => <span className="font-mono text-xs">{r.pppoe_username ?? "-"}</span> },
          { key: "due", label: "Jatuh Tempo", render: (r: any) => <span className="whitespace-nowrap">Tgl {r.due_day ?? "-"}</span> },
          { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
        ]}
        actions={(r: any) => (
          <>
            <RowBtn title="Detail" icon="eye" tone="brand" onClick={() => openDetail(r)} />
            <RowBtn title="Ubah" icon="pencil" onClick={() => openEdit(r)} />
            <RowBtn title="Hapus" icon="trash" tone="red" onClick={() => setConfirmDelete(r)} />
          </>
        )}
      />

      {/* Modal tambah / edit */}
      <Modal open={modal === "add" || modal === "edit"} onClose={() => setModal(null)}
        title={modal === "add" ? "Tambah Pelanggan" : "Ubah Pelanggan"} wide>
        {formFields}
      </Modal>

      {/* Modal detail */}
      <Modal open={modal === "detail"} onClose={() => setModal(null)} title="Detail Pelanggan" wide>
        {detail ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-lg font-bold text-brand-700">
                  {String(detail.name ?? "A").charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="text-lg font-bold text-slate-900">{detail.name}</p>
                  <p className="text-xs text-slate-400">{detail.phone ?? "-"} • {detail.email ?? "-"}</p>
                </div>
              </div>
              <StatusBadge status={detail.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Paket", detail.package_name ?? pkgName(detail.package_id)],
                ["Tipe Koneksi", detail.connection_type ?? "-"],
                ["Username PPPoE", detail.pppoe_username ?? "-"],
                ["Jatuh Tempo", `Tanggal ${detail.due_day ?? "-"}`],
                ["Alamat", detail.address ?? "-"],
                ["Terdaftar", detail.created_at ? todayID(detail.created_at) : "-"],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{l}</p>
                  <p className="mt-1 truncate text-sm font-medium text-slate-800" title={String(v)}>{v}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">Ubah Status Layanan</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ["aktif", "Aktifkan", "btn-primary"],
                  ["isolir", "Isolir", "btn-outline"],
                  ["nonaktif", "Nonaktifkan", "btn-danger"],
                ].map(([st, label, cls]) => (
                  <button key={st} type="button" disabled={changing}
                    onClick={() => changeStatus(st)}
                    className={`${cls} ${String(detail.status).toLowerCase() === st ? "ring-2 ring-offset-1 ring-brand-200" : ""}`}>
                    {changing ? "Memproses..." : label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">Isolir memutus akses internet pelanggan sementara.</p>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-bold text-slate-900">Riwayat Tagihan</h4>
              {detailInvoices.loading ? (
                <p className="text-sm text-slate-400">Memuat tagihan...</p>
              ) : asList(detailInvoices.data).length === 0 ? (
                <p className="text-sm text-slate-400">Belum ada tagihan untuk pelanggan ini.</p>
              ) : (
                <ul className="divide-y divide-slate-50 rounded-xl border border-slate-100">
                  {asList(detailInvoices.data).slice(0, 8).map((inv: any, i: number) => (
                    <li key={inv.id ?? i} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <div className="text-sm">
                        <span className="font-mono text-xs font-semibold">{inv.code ?? inv.kode}</span>
                        <span className="ml-2 text-slate-400">{inv.period ?? ""}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{rupiah(inv.amount ?? inv.total ?? 0)}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Data pelanggan tidak ditemukan.</p>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={remove}
        loading={changing}
        danger
        title="Hapus Pelanggan"
        confirmLabel="Ya, hapus"
        message={<>Hapus pelanggan <b>{confirmDelete?.name}</b>? Data tagihan terkait mungkin ikut terhapus.</>}
      />

      {/* Modal import CSV */}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import Pelanggan (CSV)" wide>
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Satu pelanggan per baris, format: <code className="font-mono">nama,telepon,email,alamat,package_id</code>
            <br />Contoh: <code className="font-mono">Budi Santoso,081234567890,budi@mail.id,Jl. Mawar 1,2</code>
            <br />Nomor telepon yang sudah terdaftar akan dilewati otomatis.
          </p>
          <Field label="Data CSV">
            <textarea className="input font-mono" rows={8} value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={"Budi Santoso,081234567890,budi@mail.id,Jl. Mawar 1,2\nSiti Aminah,081298765432,,Jl. Melati 5,"} />
          </Field>
          {importResult && (
            <div className={`rounded-xl px-3 py-2 text-sm ${importResult.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              {importResult.error
                ? importResult.error
                : <>Berhasil: <b>{importResult.inserted}</b> ditambah, <b>{importResult.skipped}</b> dilewati.</>}
              {Array.isArray(importResult.errors) && importResult.errors.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {importResult.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setImportOpen(false)}>Tutup</button>
            <button type="button" className="btn-primary" onClick={doImport} disabled={importing || !csv.trim()}>
              {importing ? "Mengimpor..." : "Import Sekarang"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
