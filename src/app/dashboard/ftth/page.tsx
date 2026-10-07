"use client";

import { useState } from "react";
import {
  ConfirmDialog, DataTable, Field, FormError, Icon,
  Modal, PageHeader, RowBtn, Select, StatusBadge, Tabs,
} from "@/components/admin";
import { api, asList, useApi } from "@/lib/api";

const EMPTY_OLT = { name: "", brand: "", host: "", port: "22", username: "", password: "", address: "", is_active: true };
const EMPTY_ODC = { name: "", olt_id: "", capacity: "144", address: "", latitude: "", longitude: "", is_active: true };
const EMPTY_ODP = { name: "", odc_id: "", capacity: "16", address: "", latitude: "", longitude: "", is_active: true };

function useCrud(path: string) {
  const q = useApi<any>(path);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({});
  const [empty, setEmptyState] = useState<any>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<any>(null);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  function openAdd(e: any) { setEmptyState(e); setForm({ ...e }); setEditId(null); setErr(null); setModal(true); }
  function openEdit(row: any, map: (r: any) => any) {
    setForm(map(row)); setEditId(row.id); setErr(null); setModal(true);
  }
  async function save() {
    if (!String(form.name ?? "").trim()) { setErr("Nama wajib diisi."); return; }
    setSaving(true); setErr(null);
    try {
      if (editId) await api(`${path}/${editId}`, { method: "PUT", body: JSON.stringify(form) });
      else await api(path, { method: "POST", body: JSON.stringify(form) });
      setModal(false); q.reload();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }
  async function remove() {
    if (!del) return;
    try { await api(`${path}/${del.id}`, { method: "DELETE" }); setDel(null); q.reload(); }
    catch (e: any) { alert(e.message); }
  }
  return { q, modal, setModal, form, set, editId, err, saving, del, setDel, openAdd, openEdit, save, remove, empty };
}

export default function FtthPage() {
  const [tab, setTab] = useState("olt");
  const olt = useCrud("/api/olt");
  const odc = useCrud("/api/odc");
  const odp = useCrud("/api/odp");

  const oltList = asList(olt.q.data);
  const odcList = asList(odc.q.data);
  const odpList = asList(odp.q.data);

  const oltName = (id: any) => oltList.find((o: any) => String(o.id) === String(id))?.name ?? "-";
  const odcName = (id: any) => odcList.find((o: any) => String(o.id) === String(id))?.name ?? "-";
  const coords = (r: any) =>
    r.latitude != null && r.longitude != null ? `${r.latitude}, ${r.longitude}` : "-";

  const activeBadge = (r: any) => (
    <StatusBadge status={(r.is_active ?? r.active ?? true) ? "aktif" : "nonaktif"} />
  );

  const modalFooter = (c: ReturnType<typeof useCrud>) => (
    <div className="mt-5 flex justify-end gap-2">
      <button type="button" className="btn-outline" onClick={() => c.setModal(false)}>Batal</button>
      <button type="button" className="btn-primary" onClick={c.save} disabled={c.saving}>
        {c.saving ? "Menyimpan..." : "Simpan"}
      </button>
    </div>
  );

  const activeToggle = (c: ReturnType<typeof useCrud>) => (
    <label className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
      <input type="checkbox" className="h-4 w-4 rounded accent-brand-600"
        checked={!!c.form.is_active} onChange={(e) => c.set("is_active", e.target.checked)} />
      <span className="text-sm font-medium text-slate-700">Aktif</span>
    </label>
  );

  return (
    <div>
      <PageHeader
        title="Infrastruktur FTTH"
        subtitle="OLT → ODC → ODP : hierarki jaringan fiber optik"
      />

      <Tabs
        value={tab} onChange={setTab}
        tabs={[
          { key: "olt", label: `OLT (${oltList.length})`, icon: "server" },
          { key: "odc", label: `ODC (${odcList.length})`, icon: "network" },
          { key: "odp", label: `ODP (${odpList.length})`, icon: "mapPin" },
        ]}
      />

      {/* ===== OLT ===== */}
      {tab === "olt" && (
        <div className="mt-5">
          <div className="mb-4 flex justify-end">
            <button type="button" className="btn-primary" onClick={() => olt.openAdd(EMPTY_OLT)}>
              <Icon name="plus" className="h-4 w-4" /> Tambah OLT
            </button>
          </div>
          <DataTable loading={olt.q.loading} rows={oltList} emptyText="Belum ada OLT"
            rowKey={(r: any) => String(r.id)}
            columns={[
              { key: "name", label: "Nama", render: (r: any) => <div><p className="font-semibold text-slate-900">{r.name}</p><p className="text-xs text-slate-400">{r.brand ?? "-"}</p></div> },
              { key: "host", label: "Host", render: (r: any) => <span className="font-mono text-xs">{r.host ?? "-"}{r.port ? `:${r.port}` : ""}</span> },
              { key: "address", label: "Alamat", render: (r: any) => <span className="line-clamp-2 max-w-xs">{r.address ?? "-"}</span> },
              { key: "status", label: "Status", render: activeBadge },
            ]}
            actions={(r: any) => (
              <>
                <RowBtn title="Ubah" icon="pencil" onClick={() => olt.openEdit(r, (x: any) => ({
                  name: x.name ?? "", brand: x.brand ?? "", host: x.host ?? "", port: String(x.port ?? "22"),
                  username: x.username ?? "", password: x.password ?? "", address: x.address ?? "",
                  is_active: x.is_active ?? x.active ?? true,
                }))} />
                <RowBtn title="Hapus" icon="trash" tone="red" onClick={() => olt.setDel(r)} />
              </>
            )}
          />
        </div>
      )}

      {/* ===== ODC ===== */}
      {tab === "odc" && (
        <div className="mt-5">
          <div className="mb-4 flex justify-end">
            <button type="button" className="btn-primary" onClick={() => odc.openAdd(EMPTY_ODC)}>
              <Icon name="plus" className="h-4 w-4" /> Tambah ODC
            </button>
          </div>
          <DataTable loading={odc.q.loading} rows={odcList} emptyText="Belum ada ODC"
            rowKey={(r: any) => String(r.id)}
            columns={[
              { key: "name", label: "Nama ODC", render: (r: any) => <span className="font-semibold text-slate-900">{r.name}</span> },
              { key: "olt", label: "OLT Induk", render: (r: any) => r.olt_name ?? oltName(r.olt_id) },
              { key: "capacity", label: "Kapasitas", render: (r: any) => r.capacity ? `${r.capacity} core` : "-" },
              { key: "coords", label: "Koordinat", render: (r: any) => <span className="font-mono text-xs">{coords(r)}</span> },
              { key: "status", label: "Status", render: activeBadge },
            ]}
            actions={(r: any) => (
              <>
                <RowBtn title="Ubah" icon="pencil" onClick={() => odc.openEdit(r, (x: any) => ({
                  name: x.name ?? "", olt_id: x.olt_id ?? "", capacity: String(x.capacity ?? "144"),
                  address: x.address ?? "", latitude: x.latitude ?? "", longitude: x.longitude ?? "",
                  is_active: x.is_active ?? x.active ?? true,
                }))} />
                <RowBtn title="Hapus" icon="trash" tone="red" onClick={() => odc.setDel(r)} />
              </>
            )}
          />
        </div>
      )}

      {/* ===== ODP ===== */}
      {tab === "odp" && (
        <div className="mt-5">
          <div className="mb-4 flex justify-end">
            <button type="button" className="btn-primary" onClick={() => odp.openAdd(EMPTY_ODP)}>
              <Icon name="plus" className="h-4 w-4" /> Tambah ODP
            </button>
          </div>
          <DataTable loading={odp.q.loading} rows={odpList} emptyText="Belum ada ODP"
            rowKey={(r: any) => String(r.id)}
            columns={[
              { key: "name", label: "Nama ODP", render: (r: any) => <span className="font-semibold text-slate-900">{r.name}</span> },
              { key: "odc", label: "ODC Induk", render: (r: any) => r.odc_name ?? odcName(r.odc_id) },
              { key: "capacity", label: "Port", render: (r: any) => r.capacity ? `${r.capacity} port` : "-" },
              { key: "coords", label: "Koordinat", render: (r: any) => <span className="font-mono text-xs">{coords(r)}</span> },
              { key: "status", label: "Status", render: activeBadge },
            ]}
            actions={(r: any) => (
              <>
                <RowBtn title="Ubah" icon="pencil" onClick={() => odp.openEdit(r, (x: any) => ({
                  name: x.name ?? "", odc_id: x.odc_id ?? "", capacity: String(x.capacity ?? "16"),
                  address: x.address ?? "", latitude: x.latitude ?? "", longitude: x.longitude ?? "",
                  is_active: x.is_active ?? x.active ?? true,
                }))} />
                <RowBtn title="Hapus" icon="trash" tone="red" onClick={() => odp.setDel(r)} />
              </>
            )}
          />
        </div>
      )}

      {/* Modal OLT */}
      <Modal open={olt.modal} onClose={() => olt.setModal(false)} title={olt.editId ? "Ubah OLT" : "Tambah OLT"}>
        <FormError message={olt.err} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama OLT"><input className="input" value={olt.form.name ?? ""} onChange={(e) => olt.set("name", e.target.value)} placeholder="cth: OLT-Pusat-01" /></Field>
          <Field label="Brand / Tipe"><input className="input" value={olt.form.brand ?? ""} onChange={(e) => olt.set("brand", e.target.value)} placeholder="cth: Huawei MA5608T" /></Field>
          <Field label="Host / IP"><input className="input font-mono" value={olt.form.host ?? ""} onChange={(e) => olt.set("host", e.target.value)} placeholder="10.0.0.2" /></Field>
          <Field label="Port"><input className="input" value={olt.form.port ?? ""} onChange={(e) => olt.set("port", e.target.value)} placeholder="22" /></Field>
          <Field label="Username"><input className="input" value={olt.form.username ?? ""} onChange={(e) => olt.set("username", e.target.value)} /></Field>
          <Field label="Password"><input className="input" type="password" value={olt.form.password ?? ""} onChange={(e) => olt.set("password", e.target.value)} /></Field>
          <Field label="Alamat" className="sm:col-span-2"><input className="input" value={olt.form.address ?? ""} onChange={(e) => olt.set("address", e.target.value)} /></Field>
          {activeToggle(olt)}
        </div>
        {modalFooter(olt)}
      </Modal>

      {/* Modal ODC */}
      <Modal open={odc.modal} onClose={() => odc.setModal(false)} title={odc.editId ? "Ubah ODC" : "Tambah ODC"}>
        <FormError message={odc.err} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama ODC"><input className="input" value={odc.form.name ?? ""} onChange={(e) => odc.set("name", e.target.value)} placeholder="cth: ODC-Merdeka" /></Field>
          <Field label="OLT Induk">
            <Select value={odc.form.olt_id ?? ""} onChange={(e) => odc.set("olt_id", e.target.value)}>
              <option value="">-- Pilih OLT --</option>
              {oltList.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </Field>
          <Field label="Kapasitas (core)"><input className="input" value={odc.form.capacity ?? ""} onChange={(e) => odc.set("capacity", e.target.value)} /></Field>
          <Field label="Alamat"><input className="input" value={odc.form.address ?? ""} onChange={(e) => odc.set("address", e.target.value)} /></Field>
          <Field label="Latitude"><input className="input font-mono" value={odc.form.latitude ?? ""} onChange={(e) => odc.set("latitude", e.target.value)} placeholder="-6.2" /></Field>
          <Field label="Longitude"><input className="input font-mono" value={odc.form.longitude ?? ""} onChange={(e) => odc.set("longitude", e.target.value)} placeholder="106.8" /></Field>
          {activeToggle(odc)}
        </div>
        {modalFooter(odc)}
      </Modal>

      {/* Modal ODP */}
      <Modal open={odp.modal} onClose={() => odp.setModal(false)} title={odp.editId ? "Ubah ODP" : "Tambah ODP"}>
        <FormError message={odp.err} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama ODP"><input className="input" value={odp.form.name ?? ""} onChange={(e) => odp.set("name", e.target.value)} placeholder="cth: ODP-MDK-014" /></Field>
          <Field label="ODC Induk">
            <Select value={odp.form.odc_id ?? ""} onChange={(e) => odp.set("odc_id", e.target.value)}>
              <option value="">-- Pilih ODC --</option>
              {odcList.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </Field>
          <Field label="Kapasitas (port)"><input className="input" value={odp.form.capacity ?? ""} onChange={(e) => odp.set("capacity", e.target.value)} /></Field>
          <Field label="Alamat"><input className="input" value={odp.form.address ?? ""} onChange={(e) => odp.set("address", e.target.value)} /></Field>
          <Field label="Latitude"><input className="input font-mono" value={odp.form.latitude ?? ""} onChange={(e) => odp.set("latitude", e.target.value)} placeholder="-6.2" /></Field>
          <Field label="Longitude"><input className="input font-mono" value={odp.form.longitude ?? ""} onChange={(e) => odp.set("longitude", e.target.value)} placeholder="106.8" /></Field>
          {activeToggle(odp)}
        </div>
        {modalFooter(odp)}
      </Modal>

      <ConfirmDialog open={!!olt.del} onClose={() => olt.setDel(null)} onConfirm={olt.remove} danger
        title="Hapus OLT" confirmLabel="Ya, hapus" message={<>Hapus OLT <b>{olt.del?.name}</b>?</>} />
      <ConfirmDialog open={!!odc.del} onClose={() => odc.setDel(null)} onConfirm={odc.remove} danger
        title="Hapus ODC" confirmLabel="Ya, hapus" message={<>Hapus ODC <b>{odc.del?.name}</b>?</>} />
      <ConfirmDialog open={!!odp.del} onClose={() => odp.setDel(null)} onConfirm={odp.remove} danger
        title="Hapus ODP" confirmLabel="Ya, hapus" message={<>Hapus ODP <b>{odp.del?.name}</b>?</>} />
    </div>
  );
}
