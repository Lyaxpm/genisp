"use client";

import { useState } from "react";
import {
  ConfirmDialog, DataTable, ErrorBox, Field, Icon, Modal,
  PageHeader, SearchInput, Select, Tabs,
} from "@/components/admin";
import { api, asList, useApi } from "@/lib/api";
import { todayID } from "@/lib/utils";

const TABS = [
  { key: "modem", label: "Modem" },
  { key: "gsm", label: "GSM" },
  { key: "voip", label: "VoIP" },
  { key: "onu", label: "ONU" },
];

export default function MasterPage() {
  const [tab, setTab] = useState("modem");
  return (
    <div>
      <PageHeader title="Data Master" subtitle="Modem pelanggan, user GSM, nomor VoIP, perangkat ONU" />
      <div className="mb-5"><Tabs tabs={TABS} value={tab} onChange={setTab} /></div>
      {tab === "modem" && <ModemTab />}
      {tab === "gsm" && <GsmTab />}
      {tab === "voip" && <VoipTab />}
      {tab === "onu" && <OnuTab />}
    </div>
  );
}

function useCrud(base: string) {
  const q = useApi<any>(base);
  const [form, setForm] = useState<any>(null);
  const [del, setDel] = useState<any>(null);
  const [working, setWorking] = useState(false);

  async function save(payload: any) {
    setWorking(true);
    try {
      await api(payload.id ? `${base}/${payload.id}` : base, {
        method: payload.id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setForm(null);
      q.reload();
    } catch (e: any) { alert(e.message); } finally { setWorking(false); }
  }

  async function remove() {
    if (!del) return;
    setWorking(true);
    try {
      await api(`${base}/${del.id}`, { method: "DELETE" });
      setDel(null);
      q.reload();
    } catch (e: any) { alert(e.message); } finally { setWorking(false); }
  }

  return { q, form, setForm, del, setDel, working, save, remove };
}

function DeleteConfirm({ del, setDel, remove, working, label }: any) {
  return (
    <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger
      title={`Hapus ${label}`} message={`Hapus data "${del?.name ?? del?.number ?? del?.brand ?? del?.id}"?`}
      confirmLabel="Hapus" loading={working} />
  );
}

/* ================= MODEM ================= */
function ModemTab() {
  const { q, form, setForm, del, setDel, working, save, remove } = useCrud("/api/masters/modems");
  const customers = useApi<any>("/api/customers?limit=500");
  const [s, setS] = useState("");
  const custList = asList(customers.data?.items ?? customers.data);
  const list = asList(q.data).filter((r: any) =>
    !s.trim() || [r.brand, r.serial_number, r.mac_address, r.customer_name].join(" ").toLowerCase().includes(s.trim().toLowerCase()));
  const f = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-64"><SearchInput value={s} onChange={setS} placeholder="Cari modem…" /></div>
        <button type="button" className="btn-primary ml-auto"
          onClick={() => setForm({ customer_id: "", brand: "", serial_number: "", mac_address: "", notes: "" })}>
          <Icon name="plus" className="h-4 w-4" /> Tambah Modem
        </button>
      </div>
      {q.error && <div className="mb-4"><ErrorBox message={q.error} onRetry={q.reload} /></div>}
      <DataTable loading={q.loading} rows={list} emptyText="Belum ada data modem" rowKey={(r: any) => String(r.id)}
        columns={[
          { key: "brand", label: "Brand", render: (r: any) => (
            <div><p className="text-sm font-semibold">{r.brand ?? "—"}</p>
            <p className="font-mono text-xs text-slate-400">SN: {r.serial_number ?? "—"}</p></div>) },
          { key: "mac", label: "MAC", render: (r: any) => <span className="font-mono text-xs">{r.mac_address ?? "—"}</span> },
          { key: "cust", label: "Pelanggan", render: (r: any) => (
            <span className="text-sm">{r.customer_name ?? <span className="text-slate-300">—</span>}{r.customer_code ? <span className="text-xs text-slate-400"> ({r.customer_code})</span> : ""}</span>) },
          { key: "notes", label: "Catatan", render: (r: any) => <span className="text-xs text-slate-500">{r.notes ?? "—"}</span> },
        ]}
        actions={(r: any) => (<>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs"
            onClick={() => setForm({ id: r.id, customer_id: r.customer_id ? String(r.customer_id) : "", brand: r.brand ?? "", serial_number: r.serial_number ?? "", mac_address: r.mac_address ?? "", notes: r.notes ?? "" })}>Ubah</button>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs !text-red-600" onClick={() => setDel(r)}>Hapus</button>
        </>)}
      />
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ubah Modem" : "Tambah Modem"}>
        {form && <div className="space-y-4">
          <Field label="Pelanggan"><Select value={form.customer_id} onChange={(e) => f("customer_id", e.target.value)}>
            <option value="">— Tanpa pelanggan —</option>
            {custList.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </Select></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Brand"><input className="input" value={form.brand} onChange={(e) => f("brand", e.target.value)} placeholder="cth: Huawei HG8245H" /></Field>
            <Field label="Serial number"><input className="input" value={form.serial_number} onChange={(e) => f("serial_number", e.target.value)} /></Field>
          </div>
          <Field label="MAC address"><input className="input font-mono" value={form.mac_address} onChange={(e) => f("mac_address", e.target.value)} /></Field>
          <Field label="Catatan"><textarea className="input" rows={2} value={form.notes} onChange={(e) => f("notes", e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setForm(null)}>Batal</button>
            <button type="button" className="btn-primary" disabled={working}
              onClick={() => save({ ...form, customer_id: form.customer_id ? Number(form.customer_id) : null })}>Simpan</button>
          </div>
        </div>}
      </Modal>
      <DeleteConfirm del={del} setDel={setDel} remove={remove} working={working} label="modem" />
    </div>
  );
}

/* ================= GSM ================= */
function GsmTab() {
  const { q, form, setForm, del, setDel, working, save, remove } = useCrud("/api/masters/gsm");
  const [s, setS] = useState("");
  const list = asList(q.data).filter((r: any) =>
    !s.trim() || [r.name, r.phone, r.operator].join(" ").toLowerCase().includes(s.trim().toLowerCase()));
  const f = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-64"><SearchInput value={s} onChange={setS} placeholder="Cari user GSM…" /></div>
        <button type="button" className="btn-primary ml-auto"
          onClick={() => setForm({ name: "", phone: "", operator: "", quota_mb: "" })}>
          <Icon name="plus" className="h-4 w-4" /> Tambah User GSM
        </button>
      </div>
      {q.error && <div className="mb-4"><ErrorBox message={q.error} onRetry={q.reload} /></div>}
      <DataTable loading={q.loading} rows={list} emptyText="Belum ada user GSM" rowKey={(r: any) => String(r.id)}
        columns={[
          { key: "name", label: "Nama", render: (r: any) => <span className="text-sm font-semibold">{r.name}</span> },
          { key: "phone", label: "No HP", render: (r: any) => <span className="font-mono text-sm">{r.phone}</span> },
          { key: "op", label: "Operator", render: (r: any) => <span className="text-sm">{r.operator ?? "—"}</span> },
          { key: "quota", label: "Kuota", className: "text-right", render: (r: any) => (
            <span className="font-semibold">{Number(r.quota_mb) >= 1024 ? `${(Number(r.quota_mb) / 1024).toFixed(1)} GB` : `${r.quota_mb} MB`}</span>) },
        ]}
        actions={(r: any) => (<>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs"
            onClick={() => setForm({ id: r.id, name: r.name, phone: r.phone, operator: r.operator ?? "", quota_mb: String(r.quota_mb ?? "") })}>Ubah</button>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs !text-red-600" onClick={() => setDel(r)}>Hapus</button>
        </>)}
      />
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ubah User GSM" : "Tambah User GSM"}>
        {form && <div className="space-y-4">
          <Field label="Nama"><input className="input" value={form.name} onChange={(e) => f("name", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="No HP"><input className="input" value={form.phone} onChange={(e) => f("phone", e.target.value)} /></Field>
            <Field label="Operator"><input className="input" value={form.operator} onChange={(e) => f("operator", e.target.value)} placeholder="cth: Telkomsel" /></Field>
          </div>
          <Field label="Kuota (MB)"><input type="number" min={0} className="input" value={form.quota_mb} onChange={(e) => f("quota_mb", e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setForm(null)}>Batal</button>
            <button type="button" className="btn-primary" disabled={working}
              onClick={() => { if (!form.name.trim() || !form.phone.trim()) return alert("Nama dan no HP wajib diisi"); save({ ...form, quota_mb: Number(form.quota_mb) || 0 }); }}>Simpan</button>
          </div>
        </div>}
      </Modal>
      <DeleteConfirm del={del} setDel={setDel} remove={remove} working={working} label="user GSM" />
    </div>
  );
}

/* ================= VOIP ================= */
function VoipTab() {
  const { q, form, setForm, del, setDel, working, save, remove } = useCrud("/api/masters/voip");
  const customers = useApi<any>("/api/customers?limit=500");
  const [s, setS] = useState("");
  const custList = asList(customers.data?.items ?? customers.data);
  const list = asList(q.data).filter((r: any) =>
    !s.trim() || [r.number, r.customer_name].join(" ").toLowerCase().includes(s.trim().toLowerCase()));
  const f = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-64"><SearchInput value={s} onChange={setS} placeholder="Cari nomor VoIP…" /></div>
        <button type="button" className="btn-primary ml-auto"
          onClick={() => setForm({ number: "", customer_id: "", password: "", notes: "" })}>
          <Icon name="plus" className="h-4 w-4" /> Tambah Nomor VoIP
        </button>
      </div>
      {q.error && <div className="mb-4"><ErrorBox message={q.error} onRetry={q.reload} /></div>}
      <DataTable loading={q.loading} rows={list} emptyText="Belum ada nomor VoIP" rowKey={(r: any) => String(r.id)}
        columns={[
          { key: "num", label: "Nomor", render: (r: any) => <span className="font-mono text-sm font-bold text-brand-700">{r.number}</span> },
          { key: "cust", label: "Pelanggan", render: (r: any) => <span className="text-sm">{r.customer_name ?? <span className="text-slate-300">—</span>}</span> },
          { key: "notes", label: "Catatan", render: (r: any) => <span className="text-xs text-slate-500">{r.notes ?? "—"}</span> },
        ]}
        actions={(r: any) => (<>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs"
            onClick={() => setForm({ id: r.id, number: r.number, customer_id: r.customer_id ? String(r.customer_id) : "", password: r.password ?? "", notes: r.notes ?? "" })}>Ubah</button>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs !text-red-600" onClick={() => setDel(r)}>Hapus</button>
        </>)}
      />
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ubah Nomor VoIP" : "Tambah Nomor VoIP"}>
        {form && <div className="space-y-4">
          <Field label="Nomor VoIP"><input className="input font-mono" value={form.number} onChange={(e) => f("number", e.target.value)} /></Field>
          <Field label="Pelanggan"><Select value={form.customer_id} onChange={(e) => f("customer_id", e.target.value)}>
            <option value="">— Tanpa pelanggan —</option>
            {custList.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </Select></Field>
          <Field label="Password SIP"><input className="input" value={form.password} onChange={(e) => f("password", e.target.value)} /></Field>
          <Field label="Catatan"><textarea className="input" rows={2} value={form.notes} onChange={(e) => f("notes", e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setForm(null)}>Batal</button>
            <button type="button" className="btn-primary" disabled={working}
              onClick={() => { if (!form.number.trim()) return alert("Nomor VoIP wajib diisi"); save({ ...form, customer_id: form.customer_id ? Number(form.customer_id) : null }); }}>Simpan</button>
          </div>
        </div>}
      </Modal>
      <DeleteConfirm del={del} setDel={setDel} remove={remove} working={working} label="nomor VoIP" />
    </div>
  );
}

/* ================= ONU ================= */
function OnuTab() {
  const { q, form, setForm, del, setDel, working, save, remove } = useCrud("/api/masters/onu");
  const olts = useApi<any>("/api/ftth/olts");
  const [s, setS] = useState("");
  const oltList = asList(olts.data?.items ?? olts.data);
  const list = asList(q.data).filter((r: any) =>
    !s.trim() || [r.name, r.serial_number, r.onu_no, r.olt_name].join(" ").toLowerCase().includes(s.trim().toLowerCase()));
  const f = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-64"><SearchInput value={s} onChange={setS} placeholder="Cari ONU…" /></div>
        <button type="button" className="btn-primary ml-auto"
          onClick={() => setForm({ olt_id: "", pon: "", onu_no: "", serial_number: "", name: "", status: "unknown", rx_power: "" })}>
          <Icon name="plus" className="h-4 w-4" /> Tambah ONU
        </button>
      </div>
      {q.error && <div className="mb-4"><ErrorBox message={q.error} onRetry={q.reload} /></div>}
      <DataTable loading={q.loading} rows={list} emptyText="Belum ada perangkat ONU" rowKey={(r: any) => String(r.id)}
        columns={[
          { key: "name", label: "ONU", render: (r: any) => (
            <div><p className="text-sm font-semibold">{r.name ?? `ONU ${r.onu_no ?? r.id}`}</p>
            <p className="font-mono text-xs text-slate-400">SN: {r.serial_number ?? "—"}</p></div>) },
          { key: "olt", label: "OLT / PON", render: (r: any) => (
            <span className="text-sm">{r.olt_name ?? "—"}{r.pon ? <span className="text-xs text-slate-400"> / {r.pon}</span> : ""}</span>) },
          { key: "rx", label: "Rx Power", render: (r: any) => <span className="font-mono text-xs">{r.rx_power ?? "—"}</span> },
          { key: "status", label: "Status", render: (r: any) => (
            <span className={`badge ${r.status === "online" ? "bg-green-100 text-green-700" : r.status === "offline" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
              {r.status}
            </span>) },
          { key: "upd", label: "Diperbarui", render: (r: any) => <span className="text-xs text-slate-400 whitespace-nowrap">{r.updated_at ? todayID(r.updated_at) : "—"}</span> },
        ]}
        actions={(r: any) => (<>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs"
            onClick={() => setForm({ id: r.id, olt_id: r.olt_id ? String(r.olt_id) : "", pon: r.pon ?? "", onu_no: r.onu_no ?? "", serial_number: r.serial_number ?? "", name: r.name ?? "", status: r.status ?? "unknown", rx_power: r.rx_power ?? "" })}>Ubah</button>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs !text-red-600" onClick={() => setDel(r)}>Hapus</button>
        </>)}
      />
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ubah ONU" : "Tambah ONU"}>
        {form && <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="OLT"><Select value={form.olt_id} onChange={(e) => f("olt_id", e.target.value)}>
              <option value="">— Pilih OLT —</option>
              {oltList.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select></Field>
            <Field label="PON"><input className="input" value={form.pon} onChange={(e) => f("pon", e.target.value)} placeholder="cth: PON1" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="No ONU"><input className="input" value={form.onu_no} onChange={(e) => f("onu_no", e.target.value)} /></Field>
            <Field label="Serial number"><input className="input font-mono" value={form.serial_number} onChange={(e) => f("serial_number", e.target.value)} /></Field>
          </div>
          <Field label="Nama / label"><input className="input" value={form.name} onChange={(e) => f("name", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status"><Select value={form.status} onChange={(e) => f("status", e.target.value)}>
              <option value="unknown">Unknown</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </Select></Field>
            <Field label="Rx power"><input className="input font-mono" value={form.rx_power} onChange={(e) => f("rx_power", e.target.value)} placeholder="cth: -21.5 dBm" /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setForm(null)}>Batal</button>
            <button type="button" className="btn-primary" disabled={working}
              onClick={() => save({ ...form, olt_id: form.olt_id ? Number(form.olt_id) : null })}>Simpan</button>
          </div>
        </div>}
      </Modal>
      <DeleteConfirm del={del} setDel={setDel} remove={remove} working={working} label="perangkat ONU" />
    </div>
  );
}
