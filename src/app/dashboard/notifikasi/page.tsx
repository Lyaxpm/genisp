"use client";

import { useEffect, useState } from "react";
import {
  DataTable, ErrorBox, Field, Modal, PageHeader,
  RowBtn, Select, Skeleton, StatusBadge, Tabs,
} from "@/components/admin";
import { api, asList, useApi } from "@/lib/api";

const CHANNELS = ["whatsapp", "sms", "email", "telegram"];
const PLACEHOLDERS = "{nama} {kode} {periode} {nominal} {jatuh_tempo} {perusahaan}";

function channelBadge(c: string) {
  const map: Record<string, string> = {
    whatsapp: "bg-green-50 text-green-700 ring-1 ring-green-200",
    sms: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    email: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    telegram: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    fcm: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  };
  return (
    <span className={`badge ${map[c] ?? "bg-slate-100 text-slate-600"}`}>{c.toUpperCase()}</span>
  );
}

export default function NotifikasiPage() {
  const [tab, setTab] = useState("template");

  return (
    <div>
      <PageHeader title="Notifikasi" subtitle="Template pesan, riwayat pengiriman, dan uji coba channel" />
      <Tabs
        tabs={[
          { key: "template", label: "Template" },
          { key: "log", label: "Riwayat" },
          { key: "test", label: "Test Kirim" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-4">
        {tab === "template" && <TemplateTab />}
        {tab === "log" && <LogTab />}
        {tab === "test" && <TestTab />}
      </div>
    </div>
  );
}

/* ================= TEMPLATE ================= */

function TemplateTab() {
  const tpls = useApi<any>("/api/notify/templates");
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ key: "", channel: "whatsapp", title: "", body: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const list = asList(tpls.data);

  function openEdit(t?: any) {
    setErr(null);
    if (t) setForm({ key: t.key, channel: t.channel, title: t.title ?? "", body: t.body ?? "" });
    else setForm({ key: "", channel: "whatsapp", title: "", body: "" });
    setEditing(t ?? "new");
  }

  async function save() {
    if (!form.key.trim() || !form.body.trim()) { setErr("Key dan isi template wajib diisi."); return; }
    setSaving(true); setErr(null);
    try {
      await api("/api/notify/templates", { method: "PUT", body: JSON.stringify(form) });
      setEditing(null);
      tpls.reload();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-slate-400">Placeholder: <code className="font-mono">{PLACEHOLDERS}</code></p>
        <button type="button" className="btn-primary !py-2 text-sm" onClick={() => openEdit()}>+ Template Baru</button>
      </div>
      {tpls.error && <div className="mb-4"><ErrorBox message={tpls.error} onRetry={tpls.reload} /></div>}
      {tpls.loading ? <Skeleton className="h-40" /> : (
        <DataTable
          rows={list}
          rowKey={(r: any) => r.key}
          emptyText="Belum ada template"
          columns={[
            { key: "key", label: "Key", render: (r: any) => <span className="font-mono text-xs font-semibold">{r.key}</span> },
            { key: "channel", label: "Channel", render: (r: any) => channelBadge(r.channel) },
            { key: "title", label: "Judul", render: (r: any) => r.title || "-" },
            {
              key: "body", label: "Isi",
              render: (r: any) => <p className="max-w-md truncate text-xs text-slate-500" title={r.body}>{r.body}</p>,
            },
          ]}
          actions={(r: any) => <RowBtn title="Ubah" icon="pencil" onClick={() => openEdit(r)} />}
        />
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Template Baru" : `Ubah Template`} wide>
        {err && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Key (unik)">
              <input className="input font-mono" value={form.key} disabled={editing !== "new"}
                onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="wa_bill" />
            </Field>
            <Field label="Channel">
              <Select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Judul (untuk email)">
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Judul pesan" />
          </Field>
          <Field label="Isi Template" hint={`Placeholder: ${PLACEHOLDERS}`}>
            <textarea className="input font-mono" rows={5} value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Halo {nama}, tagihan {kode} sebesar {nominal}..." />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setEditing(null)}>Batal</button>
            <button type="button" className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================= LOG ================= */

function LogTab() {
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const qs = `channel=${channel}&status=${status}&page=${page}&limit=20`;
  const log = useApi<any>(`/api/notify/log?${qs}`);

  useEffect(() => { setPage(1); }, [channel, status]);
  const data = log.data ?? {};
  const items = asList(data.items);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="sm:w-48">
          <option value="">Semua channel</option>
          {[...CHANNELS, "fcm"].map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48">
          <option value="">Semua status</option>
          <option value="queued">Queued</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </Select>
      </div>
      {log.error && <div className="mb-4"><ErrorBox message={log.error} onRetry={log.reload} /></div>}
      <DataTable
        loading={log.loading}
        rows={items}
        rowKey={(r: any) => String(r.id)}
        emptyText="Belum ada riwayat pengiriman"
        columns={[
          { key: "channel", label: "Channel", render: (r: any) => channelBadge(r.channel) },
          { key: "recipient", label: "Tujuan", render: (r: any) => <span className="font-mono text-xs">{r.recipient}</span> },
          {
            key: "message", label: "Pesan",
            render: (r: any) => <p className="max-w-md truncate text-xs text-slate-500" title={r.message}>{r.message}</p>,
          },
          {
            key: "status", label: "Status",
            render: (r: any) => (
              <span title={r.error ?? ""}>
                <StatusBadge status={r.status === "sent" ? "paid" : r.status === "failed" ? "failed" : "pending"} />
              </span>
            ),
          },
          { key: "created_at", label: "Waktu", render: (r: any) => <span className="whitespace-nowrap text-xs">{String(r.created_at ?? "").slice(0, 19).replace("T", " ")}</span> },
        ]}
      />
      <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
        <span>Total {data.total ?? 0} • Halaman {page}</span>
        <div className="flex gap-2">
          <button type="button" className="btn-outline !py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <button type="button" className="btn-outline !py-1.5 text-xs"
            disabled={items.length < 20} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      </div>
    </div>
  );
}

/* ================= TEST ================= */

function TestTab() {
  const [channel, setChannel] = useState("whatsapp");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("Halo, ini test notifikasi GenISP.");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const hints: Record<string, string> = {
    whatsapp: "Nomor WA tujuan, mis. 6281234567890",
    sms: "Nomor HP tujuan, mis. 6281234567890",
    email: "Alamat email tujuan",
    telegram: "Chat ID Telegram tujuan",
    fcm: "FCM device token",
  };

  async function send() {
    setSending(true); setErr(null); setResult(null);
    try {
      const r = await api<any>("/api/notify/test", {
        method: "POST",
        body: JSON.stringify({ channel, to, message }),
      });
      setResult(r);
    } catch (e: any) { setErr(e.message); } finally { setSending(false); }
  }

  return (
    <div className="card max-w-2xl">
      <h3 className="mb-4 text-sm font-bold text-slate-900">Kirim Test</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Channel">
            <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
              {[...CHANNELS, "fcm"].map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </Select>
          </Field>
          <Field label="Tujuan">
            <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder={hints[channel]} />
          </Field>
        </div>
        <Field label="Pesan">
          <textarea className="input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        {result && (
          <div className={`rounded-xl px-3 py-2 text-sm ${result.sent ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            {result.sent ? "✓ Terkirim" : "✗ Gagal"} — {result.error ?? `log id #${result.id}`}
          </div>
        )}
        <div className="flex justify-end">
          <button type="button" className="btn-primary" onClick={send} disabled={sending || !to.trim()}>
            {sending ? "Mengirim..." : "Kirim Test"}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Pastikan channel sudah dikonfigurasi di menu Pengaturan (key: sms_enabled, sms_api_url, email_enabled,
          smtp_host, telegram_enabled, dst). Hasil selalu tercatat di tab Riwayat.
        </p>
      </div>
    </div>
  );
}
