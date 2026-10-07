"use client";

import { useState } from "react";
import {
  ConfirmDialog, DataTable, ErrorBox, Field, Icon,
  Modal, PageHeader, StatusBadge,
} from "@/components/admin";
import { api, asList, useApi } from "@/lib/api";
import { rupiah, todayID } from "@/lib/utils";

export default function KonfirmasiPage() {
  const q = useApi<any>("/api/confirm-payments?status=pending");
  const [approve, setApprove] = useState<any>(null);
  const [reject, setReject] = useState<any>(null);
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);
  const [proof, setProof] = useState<string | null>(null);

  const list = asList(q.data);

  async function review(id: string, action: "approve" | "reject") {
    setWorking(true);
    try {
      await api(`/api/confirm-payments/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ action, note: note || undefined }),
      });
      setApprove(null); setReject(null); setNote("");
      q.reload();
    } catch (e: any) {
      alert(e.message);
    } finally { setWorking(false); }
  }

  return (
    <div>
      <PageHeader
        title="Konfirmasi Pembayaran"
        subtitle={`${list.length} menunggu verifikasi`}
        actions={
          <button type="button" className="btn-outline" onClick={q.reload}>
            <Icon name="refresh" className="h-4 w-4" /> Muat ulang
          </button>
        }
      />

      {q.error && <div className="mb-4"><ErrorBox message={q.error} onRetry={q.reload} /></div>}

      <DataTable
        loading={q.loading}
        rows={list}
        emptyText="Tidak ada konfirmasi yang menunggu"
        rowKey={(r: any) => String(r.id)}
        columns={[
          {
            key: "invoice", label: "Invoice",
            render: (r: any) => (
              <div>
                <p className="font-mono text-xs font-semibold">{r.invoice_code ?? r.invoice?.code ?? "-"}</p>
                <p className="text-xs text-slate-400">{r.customer_name ?? r.customer?.name ?? ""}</p>
              </div>
            ),
          },
          {
            key: "sender", label: "Pengirim",
            render: (r: any) => (
              <div>
                <p className="text-sm font-medium text-slate-800">{r.sender_name ?? r.sender ?? "-"}</p>
                <p className="text-xs capitalize text-slate-400">{r.method ?? r.payment_method ?? "-"}</p>
              </div>
            ),
          },
          {
            key: "amount", label: "Nominal", className: "text-right",
            render: (r: any) => <span className="font-bold text-brand-700">{rupiah(r.amount ?? 0)}</span>,
          },
          {
            key: "date", label: "Tanggal",
            render: (r: any) => <span className="whitespace-nowrap text-xs">{r.created_at ? todayID(r.created_at) : "-"}</span>,
          },
          {
            key: "proof", label: "Bukti",
            render: (r: any) => (r.proof_url ?? r.proof) ? (
              <button type="button" onClick={() => setProof(r.proof_url ?? r.proof)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                <Icon name="eye" className="h-3.5 w-3.5" /> Lihat
              </button>
            ) : <span className="text-xs text-slate-400">-</span>,
          },
        ]}
        actions={(r: any) => (
          <>
            <button type="button" onClick={() => setApprove(r)} title="Setujui"
              className="inline-flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-600">
              <Icon name="check" className="h-3.5 w-3.5" /> Setujui
            </button>
            <button type="button" onClick={() => { setReject(r); setNote(""); }} title="Tolak"
              className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50">
              <Icon name="x" className="h-3.5 w-3.5" /> Tolak
            </button>
          </>
        )}
      />

      {/* Bukti transfer */}
      <Modal open={!!proof} onClose={() => setProof(null)} title="Bukti Pembayaran" wide>
        {proof && (
          proof.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) ? (
            <img src={proof} alt="Bukti pembayaran" className="mx-auto max-h-[70vh] rounded-xl" />
          ) : (
            <a href={proof} target="_blank" rel="noreferrer"
              className="btn-primary mx-auto">
              <Icon name="external" className="h-4 w-4" /> Buka bukti di tab baru
            </a>
          )
        )}
      </Modal>

      <ConfirmDialog
        open={!!approve} onClose={() => setApprove(null)}
        onConfirm={() => approve && review(approve.id, "approve")}
        loading={working} title="Setujui Pembayaran" confirmLabel="Ya, setujui"
        message={<>Setujui konfirmasi <b>{rupiah(approve?.amount ?? 0)}</b> dari <b>{approve?.sender_name ?? approve?.sender}</b>? Invoice akan ditandai lunas.</>}
      />

      <Modal open={!!reject} onClose={() => setReject(null)} title="Tolak Pembayaran">
        <p className="text-sm text-slate-600">
          Tolak konfirmasi <b>{rupiah(reject?.amount ?? 0)}</b> dari <b>{reject?.sender_name ?? reject?.sender}</b>?
        </p>
        <Field label="Alasan penolakan (opsional)" className="mt-4">
          <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="cth: nominal tidak sesuai / bukti tidak jelas" />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setReject(null)}>Batal</button>
          <button type="button" className="btn-danger" disabled={working}
            onClick={() => reject && review(reject.id, "reject")}>
            {working ? "Memproses..." : "Tolak pembayaran"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
