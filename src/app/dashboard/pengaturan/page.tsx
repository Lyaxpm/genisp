"use client";

import { useEffect, useState } from "react";
import {
  ConfirmDialog, DataTable, ErrorBox, Field, FormError, Icon,
  Modal, PageHeader, RowBtn,
} from "@/components/admin";
import { api, asList } from "@/lib/api";

const COMPANY_FIELDS = [
  { key: "company_name", label: "Nama Perusahaan" },
  { key: "company_tagline", label: "Tagline" },
  { key: "company_address", label: "Alamat" },
  { key: "company_phone", label: "Telepon / WhatsApp" },
  { key: "company_email", label: "Email" },
  { key: "company_website", label: "Website" },
  { key: "brand_color", label: "Warna Brand (hex)" },
  { key: "invoice_prefix", label: "Prefix Nomor Invoice" },
];

const GATEWAY_FIELDS = [
  { key: "xendit_secret_key", label: "Xendit Secret Key", secret: true },
  { key: "xendit_webhook_token", label: "Xendit Webhook Token", secret: true },
  { key: "midtrans_server_key", label: "Midtrans Server Key", secret: true },
  { key: "midtrans_client_key", label: "Midtrans Client Key", secret: false },
  { key: "tripay_api_key", label: "Tripay API Key", secret: true },
  { key: "tripay_merchant_code", label: "Tripay Merchant Code", secret: false },
];

const GATEWAY_FIELDS_2 = [
  { key: "duitku_merchant_code", label: "Duitku Merchant Code", secret: false },
  { key: "duitku_api_key", label: "Duitku API Key", secret: true },
  { key: "doku_client_id", label: "Doku Client ID", secret: false },
  { key: "doku_secret", label: "Doku Secret Key", secret: true },
  { key: "ipaymu_va", label: "iPaymu Virtual Account", secret: false },
  { key: "ipaymu_api_key", label: "iPaymu API Key", secret: true },
  { key: "bni_va_prefix", label: "BNI VA Prefix (cth: 988)", secret: false },
  { key: "bni_callback_token", label: "BNI Callback Token", secret: true },
  { key: "moota_secret", label: "Moota Webhook Secret", secret: true },
  { key: "indosat_secret", label: "Indosat Webhook Secret", secret: true },
  { key: "tukeur_secret", label: "Tukeur Webhook Secret", secret: true },
];

const TAX_FIELDS = [
  { key: "ppn_percent", label: "PPN (%) — ditambahkan ke total tagihan saat checkout" },
];

function toMap(d: any): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of asList(d)) if (s?.key != null) map[String(s.key)] = String(s.value ?? "");
  if (!asList(d).length && d && typeof d === "object") {
    for (const k of Object.keys(d)) if (typeof (d as any)[k] !== "object") map[k] = String((d as any)[k] ?? "");
  }
  return map;
}

export default function PengaturanPage() {
  const [all, setAll] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [kvModal, setKvModal] = useState(false);
  const [kvForm, setKvForm] = useState({ key: "", value: "" });
  const [kvErr, setKvErr] = useState<string | null>(null);
  const [kvDel, setKvDel] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try { setAll(toMap(await api<any>("/api/settings"))); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const set = (k: string, v: string) => setAll((m) => ({ ...m, [k]: v }));

  async function saveGroup(keys: string[], label: string) {
    setSaving(label);
    try {
      const values: Record<string, string> = {};
      for (const k of keys) values[k] = all[k] ?? "";
      await api("/api/settings", { method: "PUT", body: JSON.stringify({ values }) });
      setSavedAt(`${label} tersimpan • ${new Date().toLocaleTimeString("id-ID")}`);
      setTimeout(() => setSavedAt(null), 3000);
    } catch (e: any) {
      alert(e.message);
    } finally { setSaving(null); }
  }

  async function saveKv() {
    const key = kvForm.key.trim();
    if (!key) { setKvErr("Key wajib diisi."); return; }
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify({ values: { [key]: kvForm.value } }) });
      setKvModal(false); setKvForm({ key: "", value: "" });
      load();
    } catch (e: any) { setKvErr(e.message); }
  }

  async function deleteKv() {
    if (!kvDel) return;
    try {
      await api(`/api/settings/${encodeURIComponent(kvDel)}`, { method: "DELETE" });
      setKvDel(null); load();
    } catch (e: any) { alert(e.message); }
  }

  const knownKeys = new Set([...COMPANY_FIELDS, ...GATEWAY_FIELDS, ...GATEWAY_FIELDS_2, ...TAX_FIELDS].map((f) => f.key));
  const customRows: { key: string; value: string }[] = Object.entries(all)
    .filter(([k]) => !knownKeys.has(k))
    .map(([key, value]) => ({ key, value }));

  return (
    <div>
      <PageHeader
        title="Pengaturan"
        subtitle="Identitas perusahaan, payment gateway & pengaturan lain"
        actions={savedAt ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
            <Icon name="check" className="h-3.5 w-3.5" /> {savedAt}
          </span>
        ) : undefined}
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {loading ? (
        <div className="card"><p className="text-sm text-slate-400">Memuat pengaturan...</p></div>
      ) : (
        <div className="space-y-6">
          {/* Profil perusahaan */}
          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Profil Perusahaan</h2>
                <p className="text-xs text-slate-400">Tampil di invoice & halaman publik</p>
              </div>
              <button type="button" className="btn-primary !py-2 text-sm"
                disabled={saving === "Profil perusahaan"}
                onClick={() => saveGroup(COMPANY_FIELDS.map((f) => f.key), "Profil perusahaan")}>
                {saving === "Profil perusahaan" ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {COMPANY_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}
                  className={["company_address", "company_tagline"].includes(f.key) ? "sm:col-span-2" : ""}>
                  {f.key === "brand_color" ? (
                    <div className="flex items-center gap-2">
                      <input type="color" value={all[f.key] || "#0d627c"}
                        onChange={(e) => set(f.key, e.target.value)}
                        className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" />
                      <input className="input font-mono" value={all[f.key] ?? ""}
                        onChange={(e) => set(f.key, e.target.value)} placeholder="#0d627c" />
                    </div>
                  ) : (
                    <input className="input" value={all[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={f.label} />
                  )}
                </Field>
              ))}
            </div>
          </section>

          {/* Payment gateway */}
          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Payment Gateway</h2>
                <p className="text-xs text-slate-400">Kunci API disimpan aman sebagai pengaturan</p>
              </div>
              <button type="button" className="btn-primary !py-2 text-sm"
                disabled={saving === "Gateway"}
                onClick={() => saveGroup(GATEWAY_FIELDS.map((f) => f.key), "Gateway")}>
                {saving === "Gateway" ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {GATEWAY_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <input className="input font-mono" type={f.secret ? "password" : "text"}
                    value={all[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.secret ? "••••••••" : "-"} autoComplete="off" />
                </Field>
              ))}
            </div>
          </section>

          {/* Gateway tambahan */}
          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Gateway Tambahan</h2>
                <p className="text-xs text-slate-400">Duitku, Doku, iPaymu, BNI VA, Moota, Indosat, Tukeur</p>
              </div>
              <button type="button" className="btn-primary !py-2 text-sm"
                disabled={saving === "Gateway tambahan"}
                onClick={() => saveGroup(GATEWAY_FIELDS_2.map((f) => f.key), "Gateway tambahan")}>
                {saving === "Gateway tambahan" ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {GATEWAY_FIELDS_2.map((f) => (
                <Field key={f.key} label={f.label}>
                  <input className="input font-mono" type={f.secret ? "password" : "text"}
                    value={all[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.secret ? "••••••••" : "-"} autoComplete="off" />
                </Field>
              ))}
            </div>
          </section>

          {/* Pajak */}
          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Pajak (PPN)</h2>
                <p className="text-xs text-slate-400">Persentase PPN yang ditambahkan ke total saat checkout</p>
              </div>
              <button type="button" className="btn-primary !py-2 text-sm"
                disabled={saving === "PPN"}
                onClick={() => saveGroup(TAX_FIELDS.map((f) => f.key), "PPN")}>
                {saving === "PPN" ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {TAX_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <input className="input" type="number" min="0" max="100" step="0.01"
                    value={all[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}
                    placeholder="11" />
                </Field>
              ))}
            </div>
          </section>

          {/* Key-value editor */}
          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Pengaturan Lainnya</h2>
                <p className="text-xs text-slate-400">Editor key-value bebas</p>
              </div>
              <button type="button" className="btn-outline !py-2 text-sm"
                onClick={() => { setKvForm({ key: "", value: "" }); setKvErr(null); setKvModal(true); }}>
                <Icon name="plus" className="h-4 w-4" /> Tambah
              </button>
            </div>
            <DataTable
              rows={customRows}
              emptyText="Belum ada pengaturan tambahan"
              rowKey={(r: { key: string; value: string }) => r.key}
              columns={[
                { key: "key", label: "Key", render: (r: { key: string }) => <span className="font-mono text-xs font-semibold">{r.key}</span> },
                { key: "value", label: "Value", render: (r: { key: string; value: string }) => <span className="line-clamp-2 max-w-md font-mono text-xs">{r.value}</span> },
              ]}
              actions={(r: { key: string; value: string }) => (
                <>
                  <RowBtn title="Ubah" icon="pencil" onClick={() => {
                    setKvForm({ key: r.key, value: r.value }); setKvErr(null); setKvModal(true);
                  }} />
                  <RowBtn title="Hapus" icon="trash" tone="red" onClick={() => setKvDel(r.key)} />
                </>
              )}
            />
          </section>
        </div>
      )}

      <Modal open={kvModal} onClose={() => setKvModal(false)} title="Pengaturan Key-Value">
        <FormError message={kvErr} />
        <div className="space-y-4">
          <Field label="Key">
            <input className="input font-mono" value={kvForm.key}
              onChange={(e) => setKvForm({ ...kvForm, key: e.target.value })}
              placeholder="cth: wa_notification_enabled" />
          </Field>
          <Field label="Value">
            <textarea className="input font-mono" rows={3} value={kvForm.value}
              onChange={(e) => setKvForm({ ...kvForm, value: e.target.value })} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setKvModal(false)}>Batal</button>
          <button type="button" className="btn-primary" onClick={saveKv}>Simpan</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!kvDel} onClose={() => setKvDel(null)} onConfirm={deleteKv} danger
        title="Hapus Pengaturan" confirmLabel="Ya, hapus"
        message={<>Hapus key <b className="font-mono">{kvDel}</b>?</>} />
    </div>
  );
}
