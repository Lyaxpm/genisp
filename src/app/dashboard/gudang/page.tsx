"use client";

import { useState } from "react";
import {
  ConfirmDialog, DataTable, ErrorBox, Field, Icon, Modal,
  PageHeader, SearchInput, Select, Tabs,
} from "@/components/admin";
import { api, asList, useApi } from "@/lib/api";
import { rupiah, todayID } from "@/lib/utils";

const TABS = [
  { key: "barang", label: "Barang" },
  { key: "stok", label: "Stok Masuk / Keluar" },
  { key: "beli", label: "Pembelian" },
  { key: "supplier", label: "Supplier" },
  { key: "vendor", label: "Vendor" },
];

function emptyForm() {
  return { name: "", type_id: "", unit: "pcs", buy_price: "", sell_price: "", description: "" };
}

export default function GudangPage() {
  const [tab, setTab] = useState("barang");

  return (
    <div>
      <PageHeader title="Gudang & Inventaris" subtitle="Stok barang, pembelian, supplier, dan vendor" />
      <div className="mb-5"><Tabs tabs={TABS} value={tab} onChange={setTab} /></div>
      {tab === "barang" && <BarangTab />}
      {tab === "stok" && <StokTab />}
      {tab === "beli" && <BeliTab />}
      {tab === "supplier" && <SupplierTab />}
      {tab === "vendor" && <VendorTab />}
    </div>
  );
}

/* ================= BARANG ================= */
function BarangTab() {
  const items = useApi<any>("/api/warehouse/items");
  const types = useApi<any>("/api/warehouse/item-types");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<any>(null);
  const [del, setDel] = useState<any>(null);
  const [working, setWorking] = useState(false);

  const list = asList(items.data).filter((r: any) =>
    !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()));
  const typeList = asList(types.data);

  async function save() {
    if (!form?.name?.trim()) return alert("Nama barang wajib diisi");
    setWorking(true);
    try {
      await api(form.id ? `/api/warehouse/items/${form.id}` : "/api/warehouse/items", {
        method: form.id ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          type_id: form.type_id ? Number(form.type_id) : null,
          buy_price: Number(form.buy_price) || 0,
          sell_price: Number(form.sell_price) || 0,
        }),
      });
      setForm(null);
      items.reload();
    } catch (e: any) { alert(e.message); } finally { setWorking(false); }
  }

  async function remove() {
    if (!del) return;
    setWorking(true);
    try {
      await api(`/api/warehouse/items/${del.id}`, { method: "DELETE" });
      setDel(null);
      items.reload();
    } catch (e: any) { alert(e.message); } finally { setWorking(false); }
  }

  const f = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-64"><SearchInput value={q} onChange={setQ} placeholder="Cari barang…" /></div>
        <button type="button" className="btn-primary ml-auto" onClick={() => setForm(emptyForm())}>
          <Icon name="plus" className="h-4 w-4" /> Tambah Barang
        </button>
      </div>
      {items.error && <div className="mb-4"><ErrorBox message={items.error} onRetry={items.reload} /></div>}
      <DataTable loading={items.loading} rows={list} emptyText="Belum ada barang" rowKey={(r: any) => String(r.id)}
        columns={[
          { key: "name", label: "Barang", render: (r: any) => (
            <div><p className="text-sm font-semibold text-slate-800">{r.name}</p>
            <p className="text-xs text-slate-400">{r.type_name ?? "—"}</p></div>) },
          { key: "stock", label: "Stok", render: (r: any) => (
            <span className={`badge ${Number(r.stock) <= 0 ? "bg-red-100 text-red-700" : Number(r.stock) < 5 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"}`}>
              {r.stock} {r.unit}
            </span>) },
          { key: "buy", label: "Harga Beli", className: "text-right", render: (r: any) => <span className="text-sm">{rupiah(r.buy_price)}</span> },
          { key: "sell", label: "Harga Jual", className: "text-right", render: (r: any) => <span className="text-sm font-semibold">{rupiah(r.sell_price)}</span> },
        ]}
        actions={(r: any) => (<>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs"
            onClick={() => setForm({ name: r.name, type_id: r.type_id ? String(r.type_id) : "", unit: r.unit, buy_price: String(r.buy_price ?? ""), sell_price: String(r.sell_price ?? ""), description: r.description ?? "", id: r.id })}>
            Ubah
          </button>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs !text-red-600" onClick={() => setDel(r)}>Hapus</button>
        </>)}
      />
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ubah Barang" : "Tambah Barang"}>
        {form && <div className="space-y-4">
          <Field label="Nama barang"><input className="input" value={form.name} onChange={(e) => f("name", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipe"><Select value={form.type_id} onChange={(e) => f("type_id", e.target.value)}>
              <option value="">— Pilih —</option>
              {typeList.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select></Field>
            <Field label="Satuan"><input className="input" value={form.unit} onChange={(e) => f("unit", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Harga beli"><input type="number" min={0} className="input" value={form.buy_price} onChange={(e) => f("buy_price", e.target.value)} /></Field>
            <Field label="Harga jual"><input type="number" min={0} className="input" value={form.sell_price} onChange={(e) => f("sell_price", e.target.value)} /></Field>
          </div>
          <Field label="Keterangan"><textarea className="input" rows={2} value={form.description} onChange={(e) => f("description", e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setForm(null)}>Batal</button>
            <button type="button" className="btn-primary" disabled={working} onClick={save}>Simpan</button>
          </div>
        </div>}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger
        title="Hapus barang" message={`Hapus "${del?.name}"? Riwayat stok ikut terhapus.`} confirmLabel="Hapus" loading={working} />
    </div>
  );
}

/* ================= STOK ================= */
function StokTab() {
  const moves = useApi<any>("/api/warehouse/stock");
  const items = useApi<any>("/api/warehouse/items");
  const [mForm, setMForm] = useState<any>(null); // {dir:'in'|'out', item_id, qty, notes}
  const [working, setWorking] = useState(false);
  const itemList = asList(items.data);
  const list = asList(moves.data);

  async function save() {
    const qty = Math.floor(Number(mForm?.qty) || 0);
    if (!mForm?.item_id || qty <= 0) return alert("Pilih barang dan isi jumlah > 0");
    setWorking(true);
    try {
      await api(`/api/warehouse/stock/${mForm.dir}`, {
        method: "POST",
        body: JSON.stringify({ item_id: Number(mForm.item_id), qty, notes: mForm.notes || undefined }),
      });
      setMForm(null);
      moves.reload(); items.reload();
    } catch (e: any) { alert(e.message); } finally { setWorking(false); }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button type="button" className="btn-primary" onClick={() => setMForm({ dir: "in", item_id: "", qty: "", notes: "" })}>
          <Icon name="plus" className="h-4 w-4" /> Stok Masuk
        </button>
        <button type="button" className="btn-outline" onClick={() => setMForm({ dir: "out", item_id: "", qty: "", notes: "" })}>
          Stok Keluar
        </button>
      </div>
      {moves.error && <div className="mb-4"><ErrorBox message={moves.error} onRetry={moves.reload} /></div>}
      <DataTable loading={moves.loading} rows={list} emptyText="Belum ada mutasi stok" rowKey={(r: any) => String(r.id)}
        columns={[
          { key: "date", label: "Tanggal", render: (r: any) => <span className="text-xs whitespace-nowrap">{r.created_at ? todayID(r.created_at) : "-"}</span> },
          { key: "item", label: "Barang", render: (r: any) => <span className="text-sm font-medium">{r.item_name}</span> },
          { key: "dir", label: "Arah", render: (r: any) => (
            <span className={`badge ${r.direction === "in" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {r.direction === "in" ? "Masuk" : "Keluar"}
            </span>) },
          { key: "qty", label: "Jumlah", className: "text-right", render: (r: any) => <span className="font-bold">{r.qty} {r.unit}</span> },
          { key: "ref", label: "Referensi", render: (r: any) => <span className="text-xs capitalize text-slate-400">{r.ref_type ?? "—"}</span> },
          { key: "notes", label: "Catatan", render: (r: any) => <span className="text-xs text-slate-500">{r.notes ?? "—"}</span> },
        ]}
      />
      <Modal open={!!mForm} onClose={() => setMForm(null)} title={mForm?.dir === "in" ? "Stok Masuk" : "Stok Keluar"}>
        {mForm && <div className="space-y-4">
          <Field label="Barang"><Select value={mForm.item_id} onChange={(e) => setMForm({ ...mForm, item_id: e.target.value })}>
            <option value="">— Pilih barang —</option>
            {itemList.map((it: any) => <option key={it.id} value={it.id}>{it.name} (stok: {it.stock})</option>)}
          </Select></Field>
          <Field label="Jumlah"><input type="number" min={1} className="input" value={mForm.qty} onChange={(e) => setMForm({ ...mForm, qty: e.target.value })} /></Field>
          <Field label="Catatan"><input className="input" value={mForm.notes} onChange={(e) => setMForm({ ...mForm, notes: e.target.value })} placeholder="cth: dipakai instalasi pelanggan" /></Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setMForm(null)}>Batal</button>
            <button type="button" className="btn-primary" disabled={working} onClick={save}>Simpan</button>
          </div>
        </div>}
      </Modal>
    </div>
  );
}

/* ================= PEMBELIAN ================= */
function BeliTab() {
  const buys = useApi<any>("/api/warehouse/purchases");
  const items = useApi<any>("/api/warehouse/items");
  const suppliers = useApi<any>("/api/warehouse/suppliers");
  const [form, setForm] = useState<any>(null); // {supplier_id, date, notes, rows:[{item_id,qty,price}]}
  const [detail, setDetail] = useState<any>(null);
  const [del, setDel] = useState<any>(null);
  const [working, setWorking] = useState(false);
  const itemList = asList(items.data);
  const supList = asList(suppliers.data);
  const list = asList(buys.data);

  function newForm() {
    setForm({ supplier_id: "", date: new Date().toISOString().slice(0, 10), notes: "", rows: [{ item_id: "", qty: "", price: "" }] });
  }
  const setRow = (i: number, k: string, v: any) => {
    const rows = [...form.rows]; rows[i] = { ...rows[i], [k]: v };
    if (k === "item_id") {
      const it = itemList.find((x: any) => String(x.id) === String(v));
      if (it) rows[i].price = String(it.buy_price ?? "");
    }
    setForm({ ...form, rows });
  };
  const total = form?.rows.reduce((s: number, r: any) => s + (Math.floor(Number(r.qty)) || 0) * (Number(r.price) || 0), 0) ?? 0;

  async function save() {
    const rows = form.rows.filter((r: any) => r.item_id && Math.floor(Number(r.qty)) > 0);
    if (!rows.length) return alert("Isi minimal 1 barang dengan jumlah > 0");
    setWorking(true);
    try {
      await api("/api/warehouse/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
          date: form.date, notes: form.notes || undefined,
          items: rows.map((r: any) => ({ item_id: Number(r.item_id), qty: Math.floor(Number(r.qty)), price: Number(r.price) || 0 })),
        }),
      });
      setForm(null); buys.reload(); items.reload();
    } catch (e: any) { alert(e.message); } finally { setWorking(false); }
  }

  async function openDetail(id: number) {
    try { setDetail(await api(`/api/warehouse/purchases/${id}`)); }
    catch (e: any) { alert(e.message); }
  }

  async function remove() {
    if (!del) return;
    setWorking(true);
    try {
      await api(`/api/warehouse/purchases/${del.id}`, { method: "DELETE" });
      setDel(null); buys.reload(); items.reload();
    } catch (e: any) { alert(e.message); } finally { setWorking(false); }
  }

  return (
    <div>
      <div className="mb-4 flex">
        <button type="button" className="btn-primary ml-auto" onClick={newForm}>
          <Icon name="plus" className="h-4 w-4" /> Catat Pembelian
        </button>
      </div>
      {buys.error && <div className="mb-4"><ErrorBox message={buys.error} onRetry={buys.reload} /></div>}
      <DataTable loading={buys.loading} rows={list} emptyText="Belum ada pembelian" rowKey={(r: any) => String(r.id)}
        columns={[
          { key: "date", label: "Tanggal", render: (r: any) => <span className="text-xs whitespace-nowrap">{r.date ? todayID(r.date) : "-"}</span> },
          { key: "sup", label: "Supplier", render: (r: any) => <span className="text-sm">{r.supplier_name ?? "—"}</span> },
          { key: "total", label: "Total", className: "text-right", render: (r: any) => <span className="font-bold text-brand-700">{rupiah(r.total)}</span> },
          { key: "notes", label: "Catatan", render: (r: any) => <span className="text-xs text-slate-500">{r.notes ?? "—"}</span> },
        ]}
        actions={(r: any) => (<>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs" onClick={() => openDetail(r.id)}>Detail</button>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs !text-red-600" onClick={() => setDel(r)}>Hapus</button>
        </>)}
      />
      <Modal open={!!form} onClose={() => setForm(null)} title="Catat Pembelian" wide>
        {form && <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Supplier"><Select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">— Pilih —</option>
              {supList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select></Field>
            <Field label="Tanggal"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          </div>
          {form.rows.map((r: any, i: number) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <div className="col-span-6"><Select value={r.item_id} onChange={(e) => setRow(i, "item_id", e.target.value)}>
                <option value="">— Barang —</option>
                {itemList.map((it: any) => <option key={it.id} value={it.id}>{it.name}</option>)}
              </Select></div>
              <input type="number" min={1} className="input col-span-2" placeholder="Qty" value={r.qty} onChange={(e) => setRow(i, "qty", e.target.value)} />
              <input type="number" min={0} className="input col-span-3" placeholder="Harga" value={r.price} onChange={(e) => setRow(i, "price", e.target.value)} />
              <button type="button" className="btn-outline col-span-1 !px-2" onClick={() => setForm({ ...form, rows: form.rows.filter((_: any, j: number) => j !== i) })}>×</button>
            </div>
          ))}
          <button type="button" className="btn-outline !text-xs" onClick={() => setForm({ ...form, rows: [...form.rows, { item_id: "", qty: "", price: "" }] })}>
            + Tambah baris
          </button>
          <Field label="Catatan"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">Total: <span className="text-lg font-extrabold text-brand-700">{rupiah(total)}</span></p>
            <div className="flex gap-2">
              <button type="button" className="btn-outline" onClick={() => setForm(null)}>Batal</button>
              <button type="button" className="btn-primary" disabled={working} onClick={save}>Simpan (stok +{form.rows.length} jenis)</button>
            </div>
          </div>
        </div>}
      </Modal>
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detail Pembelian">
        {detail && <div className="space-y-3">
          <p className="text-sm text-slate-500">{detail.supplier_name ?? "—"} • {detail.date ? todayID(detail.date) : ""}</p>
          {(detail.items ?? []).map((it: any) => (
            <div key={it.id} className="flex justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
              <span>{it.item_name} <span className="text-slate-400">× {it.qty} {it.unit}</span></span>
              <span className="font-semibold">{rupiah(Number(it.qty) * Number(it.price))}</span>
            </div>
          ))}
          <p className="text-right text-lg font-extrabold text-brand-700">{rupiah(detail.total)}</p>
        </div>}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger
        title="Hapus pembelian" message="Hapus catatan ini? Stok yang masuk dari pembelian ini akan dikurangi." confirmLabel="Hapus" loading={working} />
    </div>
  );
}

/* ================= SUPPLIER ================= */
function SupplierTab() {
  const sups = useApi<any>("/api/warehouse/suppliers");
  const [form, setForm] = useState<any>(null);
  const [del, setDel] = useState<any>(null);
  const [working, setWorking] = useState(false);
  const list = asList(sups.data);
  const blank = { name: "", phone: "", email: "", address: "" };
  const f = (k: string, v: any) => setForm({ ...form, [k]: v });

  async function save() {
    if (!form?.name?.trim()) return alert("Nama supplier wajib diisi");
    setWorking(true);
    try {
      await api(form.id ? `/api/warehouse/suppliers/${form.id}` : "/api/warehouse/suppliers", {
        method: form.id ? "PUT" : "POST", body: JSON.stringify(form),
      });
      setForm(null); sups.reload();
    } catch (e: any) { alert(e.message); } finally { setWorking(false); }
  }
  async function remove() {
    if (!del) return; setWorking(true);
    try { await api(`/api/warehouse/suppliers/${del.id}`, { method: "DELETE" }); setDel(null); sups.reload(); }
    catch (e: any) { alert(e.message); } finally { setWorking(false); }
  }

  return (
    <div>
      <div className="mb-4 flex"><button type="button" className="btn-primary ml-auto" onClick={() => setForm(blank)}>
        <Icon name="plus" className="h-4 w-4" /> Tambah Supplier</button></div>
      {sups.error && <div className="mb-4"><ErrorBox message={sups.error} onRetry={sups.reload} /></div>}
      <DataTable loading={sups.loading} rows={list} emptyText="Belum ada supplier" rowKey={(r: any) => String(r.id)}
        columns={[
          { key: "name", label: "Supplier", render: (r: any) => (
            <div><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-slate-400">{r.address ?? ""}</p></div>) },
          { key: "phone", label: "Telepon", render: (r: any) => <span className="text-sm">{r.phone ?? "—"}</span> },
          { key: "email", label: "Email", render: (r: any) => <span className="text-sm">{r.email ?? "—"}</span> },
        ]}
        actions={(r: any) => (<>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs"
            onClick={() => setForm({ id: r.id, name: r.name, phone: r.phone ?? "", email: r.email ?? "", address: r.address ?? "" })}>Ubah</button>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs !text-red-600" onClick={() => setDel(r)}>Hapus</button>
        </>)}
      />
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ubah Supplier" : "Tambah Supplier"}>
        {form && <div className="space-y-4">
          <Field label="Nama supplier"><input className="input" value={form.name} onChange={(e) => f("name", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Telepon"><input className="input" value={form.phone} onChange={(e) => f("phone", e.target.value)} /></Field>
            <Field label="Email"><input className="input" value={form.email} onChange={(e) => f("email", e.target.value)} /></Field>
          </div>
          <Field label="Alamat"><textarea className="input" rows={2} value={form.address} onChange={(e) => f("address", e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setForm(null)}>Batal</button>
            <button type="button" className="btn-primary" disabled={working} onClick={save}>Simpan</button>
          </div>
        </div>}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger
        title="Hapus supplier" message={`Hapus "${del?.name}"?`} confirmLabel="Hapus" loading={working} />
    </div>
  );
}

/* ================= VENDOR ================= */
function VendorTab() {
  const vends = useApi<any>("/api/warehouse/vendors");
  const [form, setForm] = useState<any>(null);
  const [del, setDel] = useState<any>(null);
  const [working, setWorking] = useState(false);
  const list = asList(vends.data);
  const blank = { name: "", service: "", bandwidth: "", price: "", contact: "", notes: "", is_active: true };
  const f = (k: string, v: any) => setForm({ ...form, [k]: v });

  async function save() {
    if (!form?.name?.trim()) return alert("Nama vendor wajib diisi");
    setWorking(true);
    try {
      await api(form.id ? `/api/warehouse/vendors/${form.id}` : "/api/warehouse/vendors", {
        method: form.id ? "PUT" : "POST",
        body: JSON.stringify({ ...form, price: Number(form.price) || 0 }),
      });
      setForm(null); vends.reload();
    } catch (e: any) { alert(e.message); } finally { setWorking(false); }
  }
  async function remove() {
    if (!del) return; setWorking(true);
    try { await api(`/api/warehouse/vendors/${del.id}`, { method: "DELETE" }); setDel(null); vends.reload(); }
    catch (e: any) { alert(e.message); } finally { setWorking(false); }
  }

  return (
    <div>
      <div className="mb-4 flex"><button type="button" className="btn-primary ml-auto" onClick={() => setForm(blank)}>
        <Icon name="plus" className="h-4 w-4" /> Tambah Vendor</button></div>
      {vends.error && <div className="mb-4"><ErrorBox message={vends.error} onRetry={vends.reload} /></div>}
      <DataTable loading={vends.loading} rows={list} emptyText="Belum ada vendor uplink" rowKey={(r: any) => String(r.id)}
        columns={[
          { key: "name", label: "Vendor", render: (r: any) => (
            <div><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-slate-400">{r.service ?? ""}</p></div>) },
          { key: "bw", label: "Bandwidth", render: (r: any) => <span className="text-sm">{r.bandwidth ?? "—"}</span> },
          { key: "price", label: "Harga/bln", className: "text-right", render: (r: any) => <span className="font-semibold">{rupiah(r.price)}</span> },
          { key: "contact", label: "Kontak", render: (r: any) => <span className="text-sm">{r.contact ?? "—"}</span> },
          { key: "active", label: "Status", render: (r: any) => (
            <span className={`badge ${r.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{r.is_active ? "Aktif" : "Nonaktif"}</span>) },
        ]}
        actions={(r: any) => (<>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs"
            onClick={() => setForm({ id: r.id, name: r.name, service: r.service ?? "", bandwidth: r.bandwidth ?? "", price: String(r.price ?? ""), contact: r.contact ?? "", notes: r.notes ?? "", is_active: r.is_active })}>Ubah</button>
          <button type="button" className="btn-outline !px-2.5 !py-1.5 !text-xs !text-red-600" onClick={() => setDel(r)}>Hapus</button>
        </>)}
      />
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ubah Vendor" : "Tambah Vendor"}>
        {form && <div className="space-y-4">
          <Field label="Nama vendor"><input className="input" value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="cth: Telkom Astinet" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Layanan"><input className="input" value={form.service} onChange={(e) => f("service", e.target.value)} placeholder="Uplink internet" /></Field>
            <Field label="Bandwidth"><input className="input" value={form.bandwidth} onChange={(e) => f("bandwidth", e.target.value)} placeholder="cth: 1 Gbps" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Harga / bulan"><input type="number" min={0} className="input" value={form.price} onChange={(e) => f("price", e.target.value)} /></Field>
            <Field label="Kontak"><input className="input" value={form.contact} onChange={(e) => f("contact", e.target.value)} /></Field>
          </div>
          <Field label="Catatan"><textarea className="input" rows={2} value={form.notes} onChange={(e) => f("notes", e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => f("is_active", e.target.checked)} className="h-4 w-4 rounded" /> Aktif</label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setForm(null)}>Batal</button>
            <button type="button" className="btn-primary" disabled={working} onClick={save}>Simpan</button>
          </div>
        </div>}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger
        title="Hapus vendor" message={`Hapus "${del?.name}"?`} confirmLabel="Hapus" loading={working} />
    </div>
  );
}
