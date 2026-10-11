"use client";

import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/api";
import { Icon, Modal, Stat } from "@/components/admin";
import type { GenieDevice } from "@/lib/genieacs";

type Customer = { customer_id: number; customer_name: string; customer_code: string };
type Device = GenieDevice & { customer: Customer | null };
type Detail = { device: GenieDevice; customer: Customer | null; tasks: { id: string; name: string; timestamp?: string }[];
  history: { id: number; action: string; status: string; task_id: string | null; created_at: string }[] };
const date = (input: string | null | undefined) => input ? new Date(input).toLocaleString("id-ID") : "Belum tersedia";
const statusLabel: Record<string, string> = { queued: "Menunggu inform", executed: "Selesai", completed: "Selesai", sending: "Sedang dikirim", unknown: "Perlu diperiksa" };

export default function GenieACSPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [connection, setConnection] = useState("");
  const [checking, setChecking] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [wifiPath, setWifiPath] = useState("");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const list = useApi<{ items: Device[]; total: number | null; page: number; limit: number }>(`/api/genieacs/devices?q=${encodeURIComponent(query)}&page=${page}`);
  const details = useApi<Detail>(selected ? `/api/genieacs/detail?device_id=${encodeURIComponent(selected)}` : null);
  const customers = useApi<{ id: number; name: string; code: string }[]>(selected ? `/api/genieacs/customers?q=${encodeURIComponent(customerQuery)}` : null);
  const detail = details.data?.device.id === selected ? details.data : null;
  const network = detail?.device.wifi.find(w => w.path === wifiPath);

  useEffect(() => {
    const timer = setTimeout(() => setCustomerQuery(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);
  useEffect(() => {
    setWifiPath(""); setSsid(""); setPassword(""); setCustomerId(""); setCustomerSearch(""); setFeedback(null);
  }, [selected]);

  async function checkConnection() {
    setChecking(true);
    try {
      const result = await api<{ latencyMs: number }>("/api/genieacs/status");
      setConnection(`Terhubung · ${result.latencyMs} ms`);
    } catch (e) { setConnection(e instanceof Error ? e.message : "Koneksi gagal"); }
    finally { setChecking(false); }
  }

  async function action(kind: "refresh" | "reboot" | "wifi") {
    if (!selected || busy) return;
    if (kind === "reboot" && !window.confirm("Reboot perangkat ini? Koneksi internet pelanggan akan terputus sementara.")) return;
    if (kind === "wifi" && !window.confirm("Simpan perubahan Wi-Fi? Perangkat yang terhubung mungkin perlu menyambung ulang.")) return;
    setBusy(true); setFeedback(null);
    try {
      const result = await api<{ status: string; auditRecorded?: boolean }>("/api/genieacs/tasks", { method: "POST", body: JSON.stringify({ device_id: selected, action: kind,
        ...(kind === "wifi" ? { path: wifiPath, ssid, ...(password ? { password } : {}) } : {}) }) });
      setPassword("");
      setFeedback({ error: false, text: result.auditRecorded === false ? "Tugas diterima ACS, tetapi pembaruan riwayat gagal. Periksa antrean sebelum mengulang." : result.status === "queued" ? "Tugas masuk antrean dan akan dijalankan saat perangkat melakukan inform. Tidak perlu mengirim ulang." : "Tugas berhasil dijalankan." });
      await details.reload(); await list.reload();
    } catch (e) { setFeedback({ error: true, text: e instanceof Error ? e.message : "Aksi gagal" }); }
    finally { setBusy(false); }
  }

  async function link(id: number | null) {
    if (!selected || busy) return;
    setBusy(true); setFeedback(null);
    try {
      await api("/api/genieacs/link", { method: "PUT", body: JSON.stringify({ device_id: selected, customer_id: id }) });
      setFeedback({ error: false, text: id === null ? "Kaitan pelanggan dilepas." : "Perangkat berhasil dikaitkan ke pelanggan." });
      await details.reload(); await list.reload();
    } catch (e) { setFeedback({ error: true, text: e instanceof Error ? e.message : "Gagal menyimpan" }); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-widest text-brand-600">Manajemen perangkat</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">GenieACS</h1>
        <p className="mt-1 text-sm text-slate-500">Pantau ONT/CPE dan kelola Wi-Fi pelanggan dari satu tempat.</p></div>
      <button type="button" className="btn-outline" onClick={checkConnection} disabled={checking}><Icon name="zap" />{checking ? "Menguji..." : "Tes koneksi ACS"}</button>
    </div>
    {connection && <p role="status" className="card text-sm">{connection}</p>}
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="Hasil pencarian" value={list.data?.total ?? "—"} icon="router" />
      <Stat label="Inform baru di halaman ini" value={list.data?.items.filter(d => d.recent).length ?? "—"} sub="Inform dalam 15 menit terakhir" icon="wifi" />
      <Stat label="Terkait di halaman ini" value={list.data?.items.filter(d => d.customer).length ?? "—"} sub="Perangkat dengan pelanggan" icon="users" />
    </div>
    <div className="card space-y-4">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}>
        <label className="sr-only" htmlFor="device-search">Cari perangkat</label>
        <input id="device-search" className="input" placeholder="Cari serial number, ID perangkat, atau pabrikan" value={search} maxLength={100} onChange={e => setSearch(e.target.value)} />
        <button className="btn-primary" type="submit"><Icon name="search" />Cari</button>
        <button className="btn-outline" type="button" onClick={() => list.reload()} disabled={list.loading}>Muat ulang</button>
      </form>
      {list.error ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{list.error}</div>
        : list.loading ? <p className="py-10 text-center text-slate-500">Memuat perangkat…</p>
        : !list.data?.items.length ? <p className="py-10 text-center text-slate-500">Belum ada perangkat yang cocok. Pastikan perangkat sudah terdaftar di ACS.</p>
        : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.data.items.map(device => <button key={device.id} type="button" onClick={() => setSelected(device.id)} className="min-w-0 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50/30">
          <div className="flex items-start justify-between gap-3"><span className="rounded-xl bg-brand-50 p-2 text-brand-600"><Icon name="router" /></span><span className={`badge ${device.recent ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{device.recent ? "Inform baru" : "Inform lama / belum ada"}</span></div>
          <p className="mt-3 truncate font-bold">{device.model || "Perangkat CPE"}</p><p className="break-all text-sm text-slate-500">{device.serial || device.id}</p>
          <p className="mt-3 truncate text-sm">{device.customer ? `${device.customer.customer_code} · ${device.customer.customer_name}` : "Belum dikaitkan ke pelanggan"}</p>
          <p className="mt-1 text-xs text-slate-400">Inform: {date(device.lastInform)}</p>
        </button>)}</div>}
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4 text-sm">
        <button className="btn-outline" disabled={page === 1 || list.loading} onClick={() => setPage(p => p - 1)}>Sebelumnya</button>
        <span>Halaman {page}</span>
        <button className="btn-outline" disabled={list.loading || !!list.error || !list.data || (list.data.total !== null ? page * 20 >= list.data.total : list.data.items.length < 20)} onClick={() => setPage(p => p + 1)}>Berikutnya</button>
      </div>
      <p className="text-xs text-slate-500">Waktu inform menunjukkan kontak terakhir dengan ACS, bukan jaminan koneksi internet sedang aktif.</p>
    </div>
    <Modal open={selected !== null} onClose={() => { if (!busy) setSelected(null); }} title="Detail perangkat" wide>
      {feedback && <p role={feedback.error ? "alert" : "status"} className={`mb-4 rounded-xl p-3 text-sm ${feedback.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{feedback.text}</p>}
      {details.error && <p role="alert" className="mb-4 text-sm text-red-600">{details.error}</p>}
      {!detail ? <p>{details.loading ? "Memuat detail…" : "Detail belum tersedia."}</p> : <div className="space-y-6">
        <div><h2 className="text-xl font-bold">{detail.device.manufacturer} {detail.device.model}</h2><p className="mt-1 break-all text-xs text-slate-500">{detail.device.id}</p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p>Serial: {detail.device.serial || "—"}</p><p>Firmware: {detail.device.software || "—"}</p><p className="sm:col-span-2">Inform terakhir: {date(detail.device.lastInform)}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => action("refresh")}><Icon name="refresh" />Refresh perangkat</button>
          <button className="btn-outline" disabled={busy || details.loading} onClick={() => details.reload()}>Muat ulang detail</button>
          <button className="btn-danger" disabled={busy} onClick={() => action("reboot")}>Reboot</button>
        </div>
        <section className="rounded-2xl border border-slate-200 p-4"><h3 className="font-bold">Pelanggan terkait</h3><p className="mt-1 text-sm text-slate-500">{detail.customer ? `${detail.customer.customer_code} · ${detail.customer.customer_name}` : "Belum ada pelanggan"}</p>
          <label className="label mt-4" htmlFor="customer-query">Cari pelanggan</label><input id="customer-query" className="input" value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setCustomerId(""); }} placeholder="Nama atau kode pelanggan" />
          {customers.error && <p className="text-sm text-red-600">{customers.error}</p>}
          <label className="label mt-3" htmlFor="customer-choice">Pilih pelanggan</label><select id="customer-choice" className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">Pilih dari hasil pencarian</option>{customers.data?.map(c => <option value={c.id} key={c.id}>{c.code} · {c.name}</option>)}</select>
          <div className="mt-3 flex flex-wrap gap-2"><button className="btn-primary" disabled={busy || !customerId} onClick={() => link(Number(customerId))}>Simpan kaitan</button>{detail.customer && <button className="btn-outline" disabled={busy} onClick={() => link(null)}>Lepas kaitan</button>}</div>
        </section>
        <form className="rounded-2xl border border-slate-200 p-4" onSubmit={e => { e.preventDefault(); action("wifi"); }}>
          <h3 className="font-bold">Pengaturan Wi-Fi</h3>
          {!detail.device.wifi.length ? <p className="mt-2 text-sm text-slate-500">Parameter Wi-Fi belum tersedia. Jalankan refresh perangkat; dukungan bergantung pada model dan firmware.</p> : <>
            <label className="label mt-4" htmlFor="wifi-network">Jaringan</label><select id="wifi-network" className="input" value={wifiPath} onChange={e => { setWifiPath(e.target.value); setSsid(detail.device.wifi.find(w => w.path === e.target.value)?.ssid ?? ""); setPassword(""); }}>
              <option value="">Pilih jaringan Wi-Fi</option>{detail.device.wifi.map((w, index) => <option key={w.path} value={w.path} disabled={!w.writable}>{index + 1}. {w.ssid || "Tanpa nama"}{w.writable ? "" : " (hanya baca)"}</option>)}</select>
            <label className="label mt-3" htmlFor="wifi-ssid">Nama Wi-Fi (SSID)</label><input id="wifi-ssid" className="input" value={ssid} onChange={e => setSsid(e.target.value)} required disabled={!network?.writable} />
            <label className="label mt-3" htmlFor="wifi-password">Password baru (opsional)</label><input id="wifi-password" className="input" type="password" autoComplete="new-password" minLength={8} maxLength={63} value={password} onChange={e => setPassword(e.target.value)} disabled={!network?.passwordPath} placeholder="Kosongkan untuk mempertahankan password" />
            {network && !network.passwordPath && <p className="mt-2 text-xs text-slate-500">Perangkat ini belum melaporkan parameter password yang dapat diubah.</p>}
            <button type="submit" className="btn-primary mt-4" disabled={busy || !network?.writable}>Simpan Wi-Fi</button>
          </>}
        </form>
        <section><h3 className="font-bold">Antrean perangkat ({detail.tasks.length})</h3>{!detail.tasks.length ? <p className="mt-2 text-sm text-slate-500">Tidak ada tugas dalam antrean.</p> : <ul className="mt-2 space-y-2">{detail.tasks.map(t => <li key={t.id} className="rounded-xl bg-slate-50 p-3 text-sm">{t.name}<span className="ml-2 text-xs text-slate-400">{date(t.timestamp)}</span></li>)}</ul>}</section>
        <section><h3 className="font-bold">Riwayat pengiriman dari GenISP</h3><p className="mt-1 text-xs text-slate-500">Status dicatat saat pengiriman. Periksa antrean dan muat ulang detail untuk memastikan perubahan pada perangkat.</p>
          <ul className="mt-3 space-y-2">{detail.history.map(h => <li key={h.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2 text-sm"><span>{h.action} · {statusLabel[h.status] ?? h.status}</span><time className="text-xs text-slate-400">{date(h.created_at)}</time></li>)}</ul>
        </section>
      </div>}
    </Modal>
  </div>;
}
