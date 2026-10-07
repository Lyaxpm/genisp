"use client";

import { useEffect, useState } from "react";
import {
  DataTable, ErrorBox, Field, Icon, Modal,
  PageHeader, SearchInput, Select, StatusBadge, Tabs,
} from "@/components/admin";
import { api, asList, useApi } from "@/lib/api";
import { todayID } from "@/lib/utils";

const STATUS_TABS = [
  { key: "", label: "Semua" },
  { key: "open", label: "Baru" },
  { key: "process", label: "Diproses" },
  { key: "done", label: "Selesai" },
  { key: "closed", label: "Ditutup" },
];

const STATUS_LABEL: Record<string, string> = {
  open: "Baru", process: "Diproses", done: "Selesai", closed: "Ditutup",
};
const PRIORITY_LABEL: Record<string, string> = { low: "Rendah", normal: "Normal", high: "Tinggi" };

function statusBadge(s: string) {
  // Petakan ke label Indonesia yang dikenal StatusBadge
  const map: Record<string, string> = {
    open: "menunggu",   // kuning: tiket baru
    process: "diproses", // slate
    done: "lunas",       // hijau: selesai
    closed: "nonaktif",  // slate: ditutup
  };
  return <StatusBadge status={map[s] ?? s} />;
}

export default function TiketPage() {
  const [tab, setTab] = useState("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [replyMsg, setReplyMsg] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const url = `/api/help/tickets?${new URLSearchParams({
    ...(tab ? { status: tab } : {}),
    ...(debounced ? { q: debounced } : {}),
  }).toString()}`;
  const tickets = useApi<any>(url);
  const users = useApi<any>("/api/users");
  const list = asList(tickets.data);
  const staffList = asList(users.data);

  async function openDetail(id: number) {
    try {
      const d = await api<any>(`/api/help/tickets/${id}`);
      setDetail(d);
      setReplies(d.replies ?? []);
      setReplyMsg("");
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function updateTicket(patch: Record<string, unknown>) {
    if (!detail) return;
    try {
      const d = await api<any>(`/api/help/tickets/${detail.id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      setDetail({ ...detail, ...d });
      tickets.reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function sendReply() {
    if (!detail || !replyMsg.trim()) return;
    setSending(true);
    try {
      const r = await api<any>(`/api/help/tickets/${detail.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: replyMsg.trim() }),
      });
      setReplies([...replies, r]);
      setReplyMsg("");
      tickets.reload();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Tiket Bantuan"
        subtitle={`${list.length} tiket`}
        actions={
          <button type="button" className="btn-outline" onClick={tickets.reload}>
            <Icon name="refresh" className="h-4 w-4" /> Muat ulang
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs tabs={STATUS_TABS} value={tab} onChange={(v) => setTab(v)} />
        <div className="ml-auto w-64">
          <SearchInput value={q} onChange={setQ} placeholder="Cari nomor / subjek / nama…" />
        </div>
      </div>

      {tickets.error && <div className="mb-4"><ErrorBox message={tickets.error} onRetry={tickets.reload} /></div>}

      <DataTable
        loading={tickets.loading}
        rows={list}
        emptyText="Belum ada tiket"
        rowKey={(r: any) => String(r.id)}
        columns={[
          {
            key: "no", label: "Tiket",
            render: (r: any) => (
              <div>
                <p className="font-mono text-xs font-bold text-brand-700">{r.ticket_no}</p>
                <p className="text-xs text-slate-400">{r.created_at ? todayID(r.created_at) : ""}</p>
              </div>
            ),
          },
          {
            key: "subject", label: "Subjek",
            render: (r: any) => (
              <div>
                <p className="text-sm font-semibold text-slate-800">{r.subject}</p>
                <p className="text-xs text-slate-400">
                  {r.name}{r.type_name ? ` • ${r.type_name}` : ""}{r.customer_code ? ` • ${r.customer_code}` : ""}
                </p>
              </div>
            ),
          },
          {
            key: "priority", label: "Prioritas",
            render: (r: any) => (
              <span className={`badge ${r.priority === "high" ? "bg-red-50 text-red-700 ring-1 ring-red-200" : r.priority === "low" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"}`}>
                {PRIORITY_LABEL[r.priority] ?? r.priority}
              </span>
            ),
          },
          { key: "status", label: "Status", render: (r: any) => statusBadge(r.status) },
          {
            key: "assigned", label: "Ditangani",
            render: (r: any) => <span className="text-xs text-slate-500">{r.assigned_name ?? <span className="text-slate-300">—</span>}</span>,
          },
        ]}
        actions={(r: any) => (
          <button type="button" onClick={() => openDetail(r.id)}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
            <Icon name="eye" className="h-3.5 w-3.5" /> Detail
          </button>
        )}
      />

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Tiket ${detail.ticket_no}` : ""} wide>
        {detail && (
          <div className="grid gap-6 md:grid-cols-5">
            <div className="md:col-span-3 space-y-4">
              <div>
                <p className="text-lg font-bold text-slate-900">{detail.subject}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {detail.name} • {detail.phone} • {detail.created_at ? todayID(detail.created_at) : ""}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
                {detail.message}
              </div>
              <div className="space-y-3">
                <p className="label !mb-0">Balasan ({replies.length})</p>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-100 p-3">
                  {replies.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Belum ada balasan.</p>}
                  {replies.map((rp: any) => (
                    <div key={rp.id} className={`rounded-xl p-3 text-sm ${rp.author_type === "staff" ? "bg-brand-50 ml-6" : "bg-slate-50 mr-6"}`}>
                      <p className="text-xs font-semibold text-slate-500 mb-1">
                        {rp.author_name ?? (rp.author_type === "staff" ? "Staff" : "Pelanggan")}
                      </p>
                      <p className="whitespace-pre-wrap text-slate-700">{rp.message}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="input" value={replyMsg} onChange={(e) => setReplyMsg(e.target.value)}
                    placeholder="Tulis balasan…" onKeyDown={(e) => e.key === "Enter" && sendReply()} />
                  <button type="button" className="btn-primary shrink-0" disabled={sending || !replyMsg.trim()} onClick={sendReply}>
                    Kirim
                  </button>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 space-y-4">
              <Field label="Status">
                <Select value={detail.status} onChange={(e) => updateTicket({ status: e.target.value })}>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label="Prioritas">
                <Select value={detail.priority} onChange={(e) => updateTicket({ priority: e.target.value })}>
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label="Ditangani oleh">
                <Select
                  value={detail.assigned_to ?? ""}
                  onChange={(e) => updateTicket({ assigned_to: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">— Belum ditentukan —</option>
                  {staffList.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </Select>
              </Field>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 space-y-1">
                <p><span className="font-semibold">Tipe:</span> {detail.type_name ?? "—"}</p>
                <p><span className="font-semibold">Pelanggan:</span> {detail.customer_name ?? detail.name}{detail.customer_code ? ` (${detail.customer_code})` : ""}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
