"use client";

import { useState } from "react";
import { StatusBadge, dateID, type Customer } from "@/components/public";
import { api, asList, useApi } from "@/lib/api";

const STATUS_ID: Record<string, string> = {
  open: "Baru", process: "Diproses", done: "Selesai", closed: "Ditutup",
};

export function TiketClient({ types, customer }: { types: { id: number; name: string }[]; customer: Customer | null }) {
  const mine = useApi<any>("/api/help/mine");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type_id: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [replyMsg, setReplyMsg] = useState("");
  const [replying, setReplying] = useState(false);

  const list = asList(mine.data);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.subject.trim() || !form.message.trim()) { setError("Subjek dan pesan wajib diisi."); return; }
    setSending(true);
    try {
      await api("/api/help/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type_id: form.type_id ? Number(form.type_id) : null }),
      });
      setForm({ type_id: "", subject: "", message: "" });
      setShowForm(false);
      mine.reload();
    } catch (e: any) { setError(e.message); } finally { setSending(false); }
  }

  async function openDetail(id: number) {
    try {
      const d = await api<any>(`/api/help/tickets/${id}`).catch(() => null);
      // member tidak bisa akses endpoint staff → ambil dari /api/help/mine + replies via track? fallback:
      if (d) { setDetail(d); setReplies(d.replies ?? []); }
      else {
        const t = list.find((x: any) => x.id === id);
        setDetail(t); setReplies([]);
      }
      setReplyMsg("");
    } catch (e: any) { alert(e.message); }
  }

  async function sendReply() {
    if (!detail || !replyMsg.trim()) return;
    setReplying(true);
    try {
      const r = await api<any>(`/api/help/tickets/${detail.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyMsg.trim() }),
      });
      setReplies([...replies, r]);
      setReplyMsg("");
    } catch (e: any) { alert(e.message); } finally { setReplying(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Tiket Bantuan</h1>
          <p className="text-sm text-slate-500 mt-1">Sampaikan kendala layanan Anda — tim support akan menindaklanjuti.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Tutup Form" : "+ Buat Tiket"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card space-y-4 animate-fade-up">
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
          <div>
            <label className="label">Kategori</label>
            <select className="input" value={form.type_id} onChange={(e) => setForm({ ...form, type_id: e.target.value })}>
              <option value="">— Pilih kategori —</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Subjek</label>
            <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="cth: Internet putus-putus" />
          </div>
          <div>
            <label className="label">Pesan</label>
            <textarea className="input" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Jelaskan kendala Anda…" />
          </div>
          <button type="submit" disabled={sending} className="btn-primary">{sending ? "Mengirim…" : "Kirim Tiket"}</button>
        </form>
      )}

      <div className="card !p-0 overflow-hidden animate-fade-up" style={{ animationDelay: "80ms" }}>
        {mine.loading ? (
          <p className="py-10 text-center text-sm text-slate-400">Memuat tiket…</p>
        ) : list.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Belum ada tiket. Buat tiket baru bila ada kendala.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {list.map((t: any) => (
              <button key={t.id} type="button" onClick={() => openDetail(t.id)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50">
                <div>
                  <p className="font-mono text-xs font-bold text-brand-700">{t.ticket_no}</p>
                  <p className="text-sm font-semibold text-slate-800">{t.subject}</p>
                  <p className="text-xs text-slate-400">{t.type_name ?? ""} • {dateID(t.updated_at ?? t.created_at)}</p>
                </div>
                <StatusBadge status={STATUS_ID[t.status] ?? t.status} />
              </button>
            ))}
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={() => setDetail(null)}>
          <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs font-bold text-brand-700">{detail.ticket_no}</p>
                <h3 className="text-lg font-extrabold text-slate-900">{detail.subject}</h3>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={STATUS_ID[detail.status] ?? detail.status} />
                <button type="button" onClick={() => setDetail(null)} className="text-xl text-slate-400 hover:text-slate-600">×</button>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm whitespace-pre-wrap text-slate-700">{detail.message}</div>
            <p className="label mt-4">Balasan</p>
            <div className="mb-3 max-h-56 space-y-2 overflow-y-auto">
              {replies.length === 0 && <p className="text-xs text-slate-400">Belum ada balasan.</p>}
              {replies.map((r: any) => (
                <div key={r.id} className={`rounded-xl p-3 text-sm ${r.author_type === "staff" ? "bg-brand-50" : "bg-slate-50 ml-6"}`}>
                  <p className="mb-1 text-xs font-semibold text-slate-500">{r.author_name ?? (r.author_type === "staff" ? "Tim Support" : customer?.name ?? "Anda")}</p>
                  <p className="whitespace-pre-wrap text-slate-700">{r.message}</p>
                </div>
              ))}
            </div>
            {detail.status !== "closed" && detail.status !== "done" && (
              <div className="flex gap-2">
                <input className="input" value={replyMsg} onChange={(e) => setReplyMsg(e.target.value)}
                  placeholder="Tulis balasan…" onKeyDown={(e) => e.key === "Enter" && sendReply()} />
                <button type="button" className="btn-primary shrink-0" disabled={replying || !replyMsg.trim()} onClick={sendReply}>Kirim</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
