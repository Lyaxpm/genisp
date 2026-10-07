"use client";

import { useState } from "react";
import { Field, StatusBadge, dateID } from "@/components/public";

type HelpType = { id: number; name: string };

const TICKET_STATUS_ID: Record<string, string> = {
  open: "Baru", process: "Diproses", done: "Selesai", closed: "Ditutup",
};

export function TicketForms({ types }: { types: HelpType[] }) {
  const [tab, setTab] = useState<"buat" | "lacak">("buat");

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
        {(["buat", "lacak"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              tab === k ? "bg-white text-brand-700 shadow-card" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {k === "buat" ? "Buat Tiket Baru" : "Lacak Tiket"}
          </button>
        ))}
      </div>
      {tab === "buat" ? <CreateForm types={types} /> : <TrackForm />}
    </div>
  );
}

function CreateForm({ types }: { types: HelpType[] }) {
  const [form, setForm] = useState({ name: "", phone: "", customer_code: "", type_id: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ticket_no: string } | null>(null);
  const f = (k: string, v: string) => setForm({ ...form, [k]: v });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.phone.trim() || !form.subject.trim() || !form.message.trim()) {
      setError("Nama, no HP, subjek, dan pesan wajib diisi.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/public/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          type_id: form.type_id ? Number(form.type_id) : null,
          customer_code: form.customer_code.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Gagal membuat tiket");
      setDone({ ticket_no: j.data.ticket_no });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="card text-center animate-fade-up">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
        <h2 className="text-xl font-extrabold text-slate-900">Tiket berhasil dibuat</h2>
        <p className="mt-2 text-sm text-slate-500">Simpan nomor tiket berikut untuk melacak status:</p>
        <p className="mx-auto mt-3 w-fit rounded-xl bg-slate-900 px-5 py-3 font-mono text-lg font-bold tracking-wider text-white">
          {done.ticket_no}
        </p>
        <button type="button" className="btn-outline mt-6" onClick={() => { setDone(null); setForm({ name: "", phone: "", customer_code: "", type_id: "", subject: "", message: "" }); }}>
          Buat tiket lain
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 animate-fade-up">
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama lengkap"><input className="input" value={form.name} onChange={(e) => f("name", e.target.value)} placeholder="Nama Anda" /></Field>
        <Field label="No HP / WhatsApp"><input className="input" value={form.phone} onChange={(e) => f("phone", e.target.value)} placeholder="08…" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ID pelanggan (opsional)"><input className="input" value={form.customer_code} onChange={(e) => f("customer_code", e.target.value)} placeholder="cth: C123456" /></Field>
        <Field label="Kategori"><select className="input" value={form.type_id} onChange={(e) => f("type_id", e.target.value)}>
          <option value="">— Pilih kategori —</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select></Field>
      </div>
      <Field label="Subjek"><input className="input" value={form.subject} onChange={(e) => f("subject", e.target.value)} placeholder="cth: Internet lambat sejak kemarin" /></Field>
      <Field label="Pesan"><textarea className="input" rows={5} value={form.message} onChange={(e) => f("message", e.target.value)} placeholder="Jelaskan kendala Anda selengkap mungkin…" /></Field>
      <button type="submit" disabled={sending} className="btn-primary w-full !py-3">
        {sending ? "Mengirim…" : "Kirim Tiket Bantuan"}
      </button>
    </form>
  );
}

function TrackForm() {
  const [no, setNo] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<any>(null);

  async function track(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setTicket(null);
    if (!no.trim() || !phone.trim()) { setError("Nomor tiket dan no HP wajib diisi."); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/public/tickets/track?${new URLSearchParams({ no: no.trim(), phone: phone.trim() })}`);
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Tiket tidak ditemukan");
      setTicket(j.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <form onSubmit={track} className="card space-y-4">
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nomor tiket"><input className="input font-mono" value={no} onChange={(e) => setNo(e.target.value)} placeholder="TIX-20261008-0001" /></Field>
          <Field label="No HP (saat membuat tiket)"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08…" /></Field>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
          {loading ? "Mencari…" : "Lacak Tiket"}
        </button>
      </form>

      {ticket && (
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-sm font-bold text-brand-700">{ticket.ticket_no}</p>
              <h3 className="text-lg font-extrabold text-slate-900">{ticket.subject}</h3>
            </div>
            <StatusBadge status={TICKET_STATUS_ID[ticket.status] ?? ticket.status} />
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-sm whitespace-pre-wrap text-slate-700">{ticket.message}</div>
          <div>
            <p className="label">Riwayat balasan</p>
            {(ticket.replies ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada balasan. Tim kami akan segera menindaklanjuti.</p>
            ) : (
              <div className="space-y-2">
                {(ticket.replies ?? []).map((r: any, i: number) => (
                  <div key={i} className={`rounded-xl p-3 text-sm ${r.author_type === "staff" ? "bg-brand-50" : "bg-slate-50"}`}>
                    <p className="mb-1 text-xs font-semibold text-slate-500">
                      {r.author_name ?? (r.author_type === "staff" ? "Tim Support" : "Anda")} • {dateID(r.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap text-slate-700">{r.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
