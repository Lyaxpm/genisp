"use client";

import { useState } from "react";
import {
  ConfirmDialog, DataTable, Field, FormError, Icon,
  Modal, PageHeader, RowBtn, SearchInput, StatusBadge,
} from "@/components/admin";
import { api, asList, useApi } from "@/lib/api";

const EMPTY = { name: "", host: "", port: "8728", username: "", password: "", location: "", is_active: true };

function fmtBytes(v: unknown): string {
  const n = Number(v ?? 0);
  if (!n || Number.isNaN(n)) return "-";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; }
  return `${x.toFixed(x >= 100 ? 0 : 1)} ${u[i]}`;
}

export default function RouterPage() {
  const q = useApi<any>("/api/routers");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [editId, setEditId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<any>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ router: any; result: any } | null>(null);
  const [live, setLive] = useState<{ router: any; data?: any; error?: string } | null>(null);
  const [liveLoading, setLiveLoading] = useState<string | null>(null);
  const [kick, setKick] = useState<any>(null);
  const [kickUser, setKickUser] = useState("");
  const [kickType, setKickType] = useState("pppoe");
  const [kickMsg, setKickMsg] = useState<string | null>(null);
  const [kicking, setKicking] = useState(false);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const list = asList(q.data).filter((r: any) =>
    [r.name, r.host, r.location].some((v) => String(v ?? "").toLowerCase().includes(search.trim().toLowerCase())));

  function openAdd() { setForm({ ...EMPTY }); setEditId(null); setErr(null); setModal(true); }
  function openEdit(r: any) {
    setForm({
      name: r.name ?? "", host: r.host ?? "", port: String(r.port ?? "8728"),
      username: r.username ?? "", password: r.password ?? "",
      location: r.location ?? "", is_active: r.is_active ?? r.active ?? true,
    });
    setEditId(r.id); setErr(null); setModal(true);
  }

  async function save() {
    if (!form.name.trim() || !form.host.trim()) { setErr("Nama dan host/IP router wajib diisi."); return; }
    setSaving(true); setErr(null);
    try {
      const payload = { ...form, port: Number(form.port) || 8728 };
      if (editId) await api(`/api/routers/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/api/routers", { method: "POST", body: JSON.stringify(payload) });
      setModal(false); q.reload();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  async function remove() {
    if (!del) return;
    try { await api(`/api/routers/${del.id}`, { method: "DELETE" }); setDel(null); q.reload(); }
    catch (e: any) { alert(e.message); }
  }

  async function test(r: any) {
    setTesting(r.id);
    try {
      const res = await api<any>(`/api/routers/${r.id}/test`, { method: "POST" });
      setTestResult({ router: r, result: res });
    } catch (e: any) {
      setTestResult({ router: r, result: { reachable: false, error: e.message } });
    } finally { setTesting(null); }
  }

  async function openLive(r: any) {
    setLiveLoading(r.id);
    try {
      const data = await api<any>(`/api/routers/${r.id}/live`);
      setLive({ router: r, data });
    } catch (e: any) {
      setLive({ router: r, error: e.message });
    } finally { setLiveLoading(null); }
  }

  function openKick(r: any) {
    setKick(r); setKickUser(""); setKickType("pppoe"); setKickMsg(null);
  }

  async function doKick() {
    if (!kick || !kickUser.trim()) { setKickMsg("Username wajib diisi."); return; }
    setKicking(true); setKickMsg(null);
    try {
      const res = await api<any>(`/api/routers/${kick.id}/kick`, {
        method: "POST",
        body: JSON.stringify({ username: kickUser.trim(), type: kickType }),
      });
      setKickMsg(res.message ?? "OK");
    } catch (e: any) {
      setKickMsg(e.message);
    } finally { setKicking(false); }
  }

  return (
    <div>
      <PageHeader
        title="Router"
        subtitle={`${list.length} perangkat MikroTik terdaftar`}
        actions={
          <button type="button" className="btn-primary" onClick={openAdd}>
            <Icon name="plus" className="h-4 w-4" /> Tambah Router
          </button>
        }
      />

      <div className="mb-4 max-w-md">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari nama, host, lokasi..." />
      </div>

      <DataTable
        loading={q.loading} rows={list} emptyText="Belum ada router"
        rowKey={(r: any) => String(r.id)}
        columns={[
          {
            key: "name", label: "Router",
            render: (r: any) => (
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon name="router" className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{r.name}</p>
                  <p className="font-mono text-xs text-slate-400">{r.host}:{r.port ?? 8728}</p>
                </div>
              </div>
            ),
          },
          { key: "location", label: "Lokasi", render: (r: any) => r.location ?? "-" },
          { key: "status", label: "Status", render: (r: any) => <StatusBadge status={(r.is_active ?? r.active ?? true) ? "aktif" : "nonaktif"} /> },
        ]}
        actions={(r: any) => (
          <>
            <button type="button" title="Test koneksi" onClick={() => test(r)} disabled={testing === r.id}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-50">
              <Icon name="zap" className="h-3.5 w-3.5" />
              {testing === r.id ? "..." : "Test"}
            </button>
            <button type="button" title="Data live router" onClick={() => openLive(r)} disabled={liveLoading === r.id}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50">
              <Icon name="wifi" className="h-3.5 w-3.5" />
              {liveLoading === r.id ? "..." : "Live"}
            </button>
            <button type="button" title="Tendang sesi user" onClick={() => openKick(r)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100">
              <Icon name="x" className="h-3.5 w-3.5" />
              Kick
            </button>
            <RowBtn title="Ubah" icon="pencil" onClick={() => openEdit(r)} />
            <RowBtn title="Hapus" icon="trash" tone="red" onClick={() => setDel(r)} />
          </>
        )}
      />

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "Ubah Router" : "Tambah Router"}>
        <FormError message={err} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama Router" className="sm:col-span-2">
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="cth: RB-Pusat" />
          </Field>
          <Field label="Host / IP">
            <input className="input font-mono" value={form.host} onChange={(e) => set("host", e.target.value)} placeholder="192.168.1.1" />
          </Field>
          <Field label="Port API">
            <input className="input" type="number" value={form.port} onChange={(e) => set("port", e.target.value)} placeholder="8728" />
          </Field>
          <Field label="Username">
            <input className="input" value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="admin" />
          </Field>
          <Field label="Password">
            <input className="input" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="••••••" />
          </Field>
          <Field label="Lokasi" className="sm:col-span-2">
            <input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="cth: Tower Pusat - Jl. Merdeka" />
          </Field>
          <label className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 rounded accent-brand-600"
              checked={!!form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            <span className="text-sm font-medium text-slate-700">Router aktif</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setModal(false)}>Batal</button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </Modal>

      {/* Hasil test koneksi */}
      <Modal open={!!testResult} onClose={() => setTestResult(null)} title="Hasil Test Koneksi">
        {testResult && (
          <div className="flex flex-col items-center gap-3 py-3 text-center">
            <span className={`flex h-14 w-14 items-center justify-center rounded-full ${
              testResult.result?.reachable ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
              <Icon name={testResult.result?.reachable ? "check" : "x"} className="h-7 w-7" />
            </span>
            <p className="font-bold text-slate-900">{testResult.router.name}</p>
            <p className="font-mono text-xs text-slate-400">{testResult.router.host}:{testResult.router.port ?? 8728}</p>
            {testResult.result?.reachable ? (
              <div className="rounded-xl bg-green-50 px-4 py-2.5 text-sm">
                <span className="font-semibold text-green-700">Terhubung</span>
                {testResult.result?.latency_ms != null && (
                  <span className="text-green-600"> • {testResult.result.latency_ms} ms</span>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
                Tidak terjangkau{testResult.result?.error ? `: ${testResult.result.error}` : ""}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={remove} danger
        title="Hapus Router" confirmLabel="Ya, hapus"
        message={<>Hapus router <b>{del?.name}</b>?</>} />

      {/* Data live router */}
      <Modal open={!!live} onClose={() => setLive(null)} title={`Live — ${live?.router?.name ?? ""}`}>
        {live && (
          <div className="space-y-5">
            {live.error ? (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{live.error}</div>
            ) : (
              <>
                <div>
                  <p className="label">System Resource</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      ["Board", live.data?.resource?.["board-name"]],
                      ["Versi", live.data?.resource?.version],
                      ["Uptime", live.data?.resource?.uptime],
                      ["CPU Load", live.data?.resource?.["cpu-load"] ? `${live.data.resource["cpu-load"]}%` : null],
                      ["Free Memory", fmtBytes(live.data?.resource?.["free-memory"])],
                      ["Free HDD", fmtBytes(live.data?.resource?.["free-hdd-space"])],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k}</p>
                        <p className="truncate font-mono text-sm font-semibold text-slate-800">{v ?? "-"}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="label">Interfaces ({live.data?.interfaces?.length ?? 0})</p>
                  <div className="max-h-72 overflow-auto rounded-xl border border-slate-100">
                    <table className="min-w-full">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr>
                          <th className="th">Interface</th>
                          <th className="th">Tipe</th>
                          <th className="th">Status</th>
                          <th className="th text-right">RX</th>
                          <th className="th text-right">TX</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(live.data?.interfaces ?? []).map((i: any, idx: number) => (
                          <tr key={idx}>
                            <td className="td font-mono font-semibold">{i.name ?? "-"}</td>
                            <td className="td">{i.type ?? "-"}</td>
                            <td className="td">
                              <StatusBadge status={i.running === "true" && i.disabled !== "true" ? "aktif" : "nonaktif"} />
                            </td>
                            <td className="td text-right font-mono">{fmtBytes(i["rx-byte"])}</td>
                            <td className="td text-right font-mono">{fmtBytes(i["tx-byte"])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Sinkronisasi user pelanggan (PPP secret / hotspot user) dilakukan otomatis
                  via endpoint <span className="font-mono">POST /api/customers/[id]/router-sync</span>.
                </p>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Kick sesi */}
      <Modal open={!!kick} onClose={() => setKick(null)} title={`Kick Sesi — ${kick?.name ?? ""}`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Username">
            <input className="input font-mono" value={kickUser} onChange={(e) => setKickUser(e.target.value)}
              placeholder="cth: pppoe-C00001" />
          </Field>
          <Field label="Tipe">
            <select className="input" value={kickType} onChange={(e) => setKickType(e.target.value)}>
              <option value="pppoe">PPPoE</option>
              <option value="hotspot">Hotspot</option>
            </select>
          </Field>
        </div>
        {kickMsg && (
          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-700">{kickMsg}</div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setKick(null)}>Tutup</button>
          <button type="button" className="btn-danger" onClick={doKick} disabled={kicking}>
            {kicking ? "Menendang..." : "Tendang Sesi"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
