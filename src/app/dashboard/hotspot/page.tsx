"use client";

import { useState } from "react";
import {
  ConfirmDialog, CopyBtn, DataTable, Field, FormError, Icon,
  Modal, PageHeader, RowBtn, Select, StatusBadge, Tabs,
} from "@/components/admin";
import { api, asList, useApi } from "@/lib/api";
import { rupiah, todayID } from "@/lib/utils";

const EMPTY_PKG = { name: "", price: "", duration: "24 jam", speed: "", quota: "", is_active: true };

export default function HotspotPage() {
  const [tab, setTab] = useState("paket");
  const pkgs = useApi<any>("/api/voucher-packages");
  const vouchers = useApi<any>("/api/vouchers");

  const [pkgModal, setPkgModal] = useState(false);
  const [pkgForm, setPkgForm] = useState<any>({ ...EMPTY_PKG });
  const [pkgEditId, setPkgEditId] = useState<string | null>(null);
  const [pkgErr, setPkgErr] = useState<string | null>(null);
  const [pkgSaving, setPkgSaving] = useState(false);
  const [pkgDel, setPkgDel] = useState<any>(null);

  const [genOpen, setGenOpen] = useState(false);
  const [genForm, setGenForm] = useState({ package_id: "", qty: "10" });
  const [genErr, setGenErr] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [generated, setGenerated] = useState<any[]>([]);

  const pset = (k: string, v: any) => setPkgForm((f: any) => ({ ...f, [k]: v }));
  const pkgList = asList(pkgs.data);
  const voucherList = asList(vouchers.data);

  function openPkgAdd() { setPkgForm({ ...EMPTY_PKG }); setPkgEditId(null); setPkgErr(null); setPkgModal(true); }
  function openPkgEdit(p: any) {
    setPkgForm({
      name: p.name ?? "", price: String(p.price ?? ""), duration: p.duration ?? "24 jam",
      speed: p.speed ?? "", quota: p.quota ?? "", is_active: p.is_active ?? p.active ?? true,
    });
    setPkgEditId(p.id); setPkgErr(null); setPkgModal(true);
  }

  async function savePkg() {
    if (!pkgForm.name.trim()) { setPkgErr("Nama paket wajib diisi."); return; }
    setPkgSaving(true); setPkgErr(null);
    try {
      const payload = { ...pkgForm, price: Number(pkgForm.price) || 0 };
      if (pkgEditId) await api(`/api/voucher-packages/${pkgEditId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/api/voucher-packages", { method: "POST", body: JSON.stringify(payload) });
      setPkgModal(false); pkgs.reload();
    } catch (e: any) { setPkgErr(e.message); } finally { setPkgSaving(false); }
  }

  async function delPkg() {
    if (!pkgDel) return;
    try { await api(`/api/voucher-packages/${pkgDel.id}`, { method: "DELETE" }); setPkgDel(null); pkgs.reload(); }
    catch (e: any) { alert(e.message); }
  }

  async function generate() {
    if (!genForm.package_id) { setGenErr("Pilih paket voucher dulu."); return; }
    const qty = Number(genForm.qty);
    if (!qty || qty < 1 || qty > 500) { setGenErr("Jumlah harus 1–500."); return; }
    setGenLoading(true); setGenErr(null);
    try {
      const res = await api<any>("/api/vouchers/generate", {
        method: "POST", body: JSON.stringify({ package_id: genForm.package_id, qty }),
      });
      setGenerated(asList(res?.vouchers ?? res));
      vouchers.reload();
    } catch (e: any) { setGenErr(e.message); } finally { setGenLoading(false); }
  }

  return (
    <div>
      <PageHeader title="Hotspot" subtitle="Kelola paket & kode voucher hotspot" />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "paket", label: "Paket Voucher", icon: "box" },
          { key: "voucher", label: "Voucher", icon: "ticket" },
        ]}
      />

      {tab === "paket" && (
        <div className="mt-5">
          <div className="mb-4 flex justify-end">
            <button type="button" className="btn-primary" onClick={openPkgAdd}>
              <Icon name="plus" className="h-4 w-4" /> Tambah Paket
            </button>
          </div>
          <DataTable
            loading={pkgs.loading} rows={pkgList} emptyText="Belum ada paket voucher"
            rowKey={(r: any) => String(r.id)}
            columns={[
              { key: "name", label: "Paket", render: (r: any) => <span className="font-semibold text-slate-900">{r.name}</span> },
              { key: "duration", label: "Durasi", render: (r: any) => r.duration ?? "-" },
              { key: "speed", label: "Speed", render: (r: any) => r.speed ? `${r.speed} Mbps` : "-" },
              { key: "quota", label: "Kuota", render: (r: any) => r.quota ?? "-" },
              { key: "price", label: "Harga", className: "text-right", render: (r: any) => <span className="font-bold text-brand-700">{rupiah(r.price ?? 0)}</span> },
              { key: "status", label: "Status", render: (r: any) => <StatusBadge status={(r.is_active ?? r.active ?? true) ? "aktif" : "nonaktif"} /> },
            ]}
            actions={(r: any) => (
              <>
                <RowBtn title="Ubah" icon="pencil" onClick={() => openPkgEdit(r)} />
                <RowBtn title="Hapus" icon="trash" tone="red" onClick={() => setPkgDel(r)} />
              </>
            )}
          />
        </div>
      )}

      {tab === "voucher" && (
        <div className="mt-5">
          <div className="mb-4 flex justify-end">
            <button type="button" className="btn-primary" onClick={() => { setGenerated([]); setGenErr(null); setGenOpen(true); }}>
              <Icon name="plus" className="h-4 w-4" /> Generate Voucher
            </button>
          </div>
          <DataTable
            loading={vouchers.loading} rows={voucherList} emptyText="Belum ada voucher"
            rowKey={(r: any) => String(r.id ?? r.code)}
            columns={[
              {
                key: "code", label: "Kode Voucher",
                render: (r: any) => <CopyBtn text={String(r.code ?? r.kode ?? "")} />,
              },
              { key: "package", label: "Paket", render: (r: any) => r.package_name ?? r.package?.name ?? "-" },
              { key: "created", label: "Dibuat", render: (r: any) => r.created_at ? todayID(r.created_at) : "-" },
              { key: "used", label: "Status", render: (r: any) => <StatusBadge status={(r.used ?? r.is_used) ? "nonaktif" : "aktif"} /> },
            ]}
          />
        </div>
      )}

      {/* Modal paket */}
      <Modal open={pkgModal} onClose={() => setPkgModal(false)} title={pkgEditId ? "Ubah Paket Voucher" : "Tambah Paket Voucher"}>
        <FormError message={pkgErr} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama Paket" className="sm:col-span-2">
            <input className="input" value={pkgForm.name} onChange={(e) => pset("name", e.target.value)} placeholder="cth: Voucher 24 Jam" />
          </Field>
          <Field label="Harga (Rp)">
            <input className="input" type="number" min={0} value={pkgForm.price} onChange={(e) => pset("price", e.target.value)} placeholder="5000" />
          </Field>
          <Field label="Durasi">
            <input className="input" value={pkgForm.duration} onChange={(e) => pset("duration", e.target.value)} placeholder="24 jam" />
          </Field>
          <Field label="Speed (Mbps)">
            <input className="input" value={pkgForm.speed} onChange={(e) => pset("speed", e.target.value)} placeholder="5" />
          </Field>
          <Field label="Kuota">
            <input className="input" value={pkgForm.quota} onChange={(e) => pset("quota", e.target.value)} placeholder="cth: 2 GB / Unlimited" />
          </Field>
          <label className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 rounded accent-brand-600"
              checked={!!pkgForm.is_active} onChange={(e) => pset("is_active", e.target.checked)} />
            <span className="text-sm font-medium text-slate-700">Paket aktif</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setPkgModal(false)}>Batal</button>
          <button type="button" className="btn-primary" onClick={savePkg} disabled={pkgSaving}>
            {pkgSaving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </Modal>

      {/* Modal generate */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate Voucher" wide>
        <FormError message={genErr} />
        {generated.length === 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Paket Voucher">
                <Select value={genForm.package_id} onChange={(e) => setGenForm({ ...genForm, package_id: e.target.value })}>
                  <option value="">-- Pilih paket --</option>
                  {pkgList.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} — {rupiah(p.price ?? 0)}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Jumlah Voucher">
                <input className="input" type="number" min={1} max={500} value={genForm.qty}
                  onChange={(e) => setGenForm({ ...genForm, qty: e.target.value })} />
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setGenOpen(false)}>Batal</button>
              <button type="button" className="btn-primary" onClick={generate} disabled={genLoading}>
                {genLoading ? "Membuat..." : "Generate"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">{generated.length} voucher berhasil dibuat</p>
              <button type="button" className="btn-outline !py-1.5 text-xs"
                onClick={() => {
                  const txt = generated.map((v: any) => v.code ?? v.kode ?? v).join("\n");
                  navigator.clipboard.writeText(txt).catch(() => {});
                }}>
                <Icon name="copy" className="h-3.5 w-3.5" /> Salin semua
              </button>
            </div>
            <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
              {generated.map((v: any, i: number) => (
                <CopyBtn key={i} text={String(v.code ?? v.kode ?? v)} />
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" className="btn-primary" onClick={() => setGenOpen(false)}>Selesai</button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog open={!!pkgDel} onClose={() => setPkgDel(null)} onConfirm={delPkg} danger
        title="Hapus Paket Voucher" confirmLabel="Ya, hapus"
        message={<>Hapus paket <b>{pkgDel?.name}</b>?</>} />
    </div>
  );
}
