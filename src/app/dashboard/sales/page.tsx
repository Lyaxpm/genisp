"use client";

import { useState } from "react";
import {
  ConfirmDialog, DataTable, Field, FormError, Icon,
  Modal, PageHeader, RowBtn, Select, Stat, StatusBadge, Tabs,
} from "@/components/admin";
import { api, asList, useApi } from "@/lib/api";
import { rupiah, todayID } from "@/lib/utils";

type Fee = {
  id: number;
  name: string;
  type: string;
  value: number | string;
  is_active: boolean;
};

type Commission = {
  id: number;
  invoice_id?: number | null;
  customer_id?: number | null;
  sales_id?: number | null;
  amount: number | string;
  status: string;
  sales_name?: string | null;
  customer_name?: string | null;
  invoice_code?: string | null;
  created_at?: string;
};

export default function SalesPage() {
  const [tab, setTab] = useState("komisi");
  const fees = useApi<unknown>("/api/sales/fees");
  const commissions = useApi<unknown>("/api/commissions");
  const feeList = asList<Fee>(fees.data);
  const comList = asList<Commission>((commissions.data as { items?: unknown })?.items);

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Fee | null>(null);
  const [form, setForm] = useState({ name: "", type: "percent", value: "", is_active: true });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Fee | null>(null);
  const [paying, setPaying] = useState<number | null>(null);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const pendingTotal = comList
    .filter((c) => c.status === "pending")
    .reduce((a, c) => a + Number(c.amount ?? 0), 0);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", type: "percent", value: "", is_active: true });
    setErr(null); setModal(true);
  }

  function openEdit(f: Fee) {
    setEditing(f);
    setForm({ name: f.name, type: f.type, value: String(f.value), is_active: !!f.is_active });
    setErr(null); setModal(true);
  }

  async function save() {
    if (!form.name.trim()) { setErr("Nama fee wajib diisi."); return; }
    if (!form.value || Number(form.value) <= 0) { setErr("Nilai fee tidak valid."); return; }
    setSaving(true); setErr(null);
    try {
      if (editing) {
        await api(`/api/sales/fees/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: form.name, type: form.type, value: Number(form.value), is_active: form.is_active }),
        });
      } else {
        await api("/api/sales/fees", {
          method: "POST",
          body: JSON.stringify({ name: form.name, type: form.type, value: Number(form.value), is_active: form.is_active }),
        });
      }
      setModal(false); fees.reload();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!del) return;
    try { await api(`/api/sales/fees/${del.id}`, { method: "DELETE" }); setDel(null); fees.reload(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
  }

  async function payCommission(id: number) {
    setPaying(id);
    try {
      await api(`/api/commissions/${id}/pay`, { method: "POST" });
      commissions.reload();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setPaying(null); }
  }

  return (
    <div>
      <PageHeader title="Sales & Komisi" subtitle="Aturan fee dan komisi sales" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat label="Komisi Belum Dibayar" icon="wallet" accent="bg-amber-50 text-amber-600"
          value={rupiah(pendingTotal)} sub={`${comList.filter((c) => c.status === "pending").length} komisi pending`} />
        <Stat label="Total Komisi" icon="chart" accent="bg-brand-50 text-brand-600"
          value={String(comList.length)} sub="Tercatat" />
      </div>

      <div className="mt-6">
        <Tabs
          value={tab} onChange={setTab}
          tabs={[
            { key: "komisi", label: "Komisi", icon: "wallet" },
            { key: "fee", label: "Aturan Fee", icon: "receipt" },
          ]}
        />
      </div>

      {tab === "komisi" ? (
        <div className="mt-4">
          <DataTable
            loading={commissions.loading} rows={comList} emptyText="Belum ada komisi"
            rowKey={(r) => String(r.id)}
            columns={[
              {
                key: "created_at", label: "Tanggal",
                render: (r: Commission) => <span className="whitespace-nowrap">{r.created_at ? todayID(r.created_at) : "-"}</span>,
              },
              { key: "sales", label: "Sales", render: (r: Commission) => r.sales_name ?? "-" },
              { key: "customer", label: "Pelanggan", render: (r: Commission) => r.customer_name ?? "-" },
              { key: "invoice", label: "Invoice", render: (r: Commission) => <span className="font-mono text-xs">{r.invoice_code ?? "-"}</span> },
              {
                key: "amount", label: "Komisi", className: "text-right",
                render: (r: Commission) => <span className="font-bold text-brand-700">{rupiah(r.amount ?? 0)}</span>,
              },
              { key: "status", label: "Status", render: (r: Commission) => <StatusBadge status={r.status} /> },
            ]}
            actions={(r: Commission) => r.status !== "paid" ? (
              <button type="button" className="btn-outline !px-3 !py-1.5 text-xs"
                disabled={paying === r.id} onClick={() => payCommission(r.id)}>
                {paying === r.id ? "..." : "Bayar"}
              </button>
            ) : null}
          />
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-3 flex justify-end">
            <button type="button" className="btn-primary" onClick={openAdd}>
              <Icon name="plus" className="h-4 w-4" /> Tambah Fee
            </button>
          </div>
          <DataTable
            loading={fees.loading} rows={feeList} emptyText="Belum ada aturan fee"
            rowKey={(r) => String(r.id)}
            columns={[
              { key: "name", label: "Nama", render: (r: Fee) => <span className="font-semibold">{r.name}</span> },
              {
                key: "value", label: "Nilai",
                render: (r: Fee) => (
                  <span className="font-bold">{r.type === "percent" ? `${r.value}%` : rupiah(r.value ?? 0)}</span>
                ),
              },
              { key: "type", label: "Tipe", render: (r: Fee) => <span className="badge bg-slate-100 text-slate-600">{r.type}</span> },
              { key: "is_active", label: "Status", render: (r: Fee) => <StatusBadge status={r.is_active ? "aktif" : "nonaktif"} /> },
            ]}
            actions={(r: Fee) => (
              <div className="flex justify-end gap-1">
                <RowBtn title="Ubah" icon="edit" onClick={() => openEdit(r)} />
                <RowBtn title="Hapus" icon="trash" tone="red" onClick={() => setDel(r)} />
              </div>
            )}
          />
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Ubah Fee" : "Tambah Fee"}>
        <FormError message={err} />
        <div className="grid grid-cols-1 gap-4">
          <Field label="Nama">
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="Komisi standar sales" />
          </Field>
          <Field label="Tipe">
            <Select value={form.type} onChange={(e) => set("type", e.target.value)}>
              <option value="percent">Persen (%) dari invoice</option>
              <option value="fixed">Nominal tetap (Rp)</option>
            </Select>
          </Field>
          <Field label={form.type === "percent" ? "Nilai (%)" : "Nilai (Rp)"}>
            <input className="input" type="number" min={0} value={form.value}
              onChange={(e) => set("value", e.target.value)} placeholder={form.type === "percent" ? "10" : "50000"} />
          </Field>
          <Field label="Status">
            <Select value={form.is_active ? "1" : "0"} onChange={(e) => set("is_active", e.target.value === "1")}>
              <option value="1">Aktif</option>
              <option value="0">Nonaktif</option>
            </Select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setModal(false)}>Batal</button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger
        title="Hapus Fee" confirmLabel="Ya, hapus"
        message={<>Hapus aturan fee <b>{del?.name}</b>?</>} />
    </div>
  );
}
