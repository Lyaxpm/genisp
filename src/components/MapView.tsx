"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { parseCoverageArea } from "@/lib/geo";

type LatLng = [number, number];

type Odc = {
  id: number; name: string; address?: string | null;
  latitude?: string | number | null; longitude?: string | number | null; capacity?: number;
};
type Odp = {
  id: number; odc_id?: number | null; name: string; address?: string | null;
  latitude?: string | number | null; longitude?: string | number | null; capacity?: number;
};
type Cust = {
  id: number; code?: string; name: string; phone?: string | null; status?: string;
  latitude?: string | number | null; longitude?: string | number | null; package_name?: string | null;
};
type Cov = { id: number; name: string; description?: string | null; area?: unknown };
type Cable = { id: number; name: string; color: string; path: LatLng[]; notes?: string | null };

type MapData = { odcs: Odc[]; odps: Odp[]; customers: Cust[]; coverages: Cov[] };

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const ICON_BASE = "https://unpkg.com/leaflet@1.9.4/dist/images";

function loadLeaflet(): Promise<any> {
  const w = window as unknown as { L?: any };
  if (w.L) return Promise.resolve(w.L);
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      const t = setInterval(() => {
        if ((window as unknown as { L?: any }).L) {
          clearInterval(t);
          resolve((window as unknown as { L?: any }).L);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(t);
        reject(new Error("Leaflet gagal dimuat"));
      }, 10000);
      return;
    }
    const s = document.createElement("script");
    s.src = LEAFLET_JS;
    s.onload = () => resolve((window as unknown as { L?: any }).L);
    s.onerror = () => reject(new Error("Leaflet gagal dimuat"));
    document.head.appendChild(s);
  });
}

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function statusColor(status?: string): string {
  switch ((status ?? "").toLowerCase()) {
    case "aktif": return "#16a34a";
    case "isolir": return "#dc2626";
    case "pending": return "#d97706";
    case "nonaktif": return "#6b7280";
    default: return "#0d627c";
  }
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default function MapView() {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const drawModeRef = useRef(false);

  const [data, setData] = useState<MapData | null>(null);
  const [cables, setCables] = useState<Cable[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [points, setPoints] = useState<LatLng[]>([]);
  const [form, setForm] = useState({ name: "", color: "#0d627c" });
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      const d = await api<MapData>("/api/map/data");
      const c = await api<{ cables: Cable[] }>("/api/map/cables");
      setData(d);
      setCables(c.cables ?? []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memuat data peta");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  // Inisialisasi peta (sekali)
  useEffect(() => {
    let map: any = null;
    let cancelled = false;
    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !divRef.current) return;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: `${ICON_BASE}/marker-icon-2x.png`,
          iconUrl: `${ICON_BASE}/marker-icon.png`,
          shadowUrl: `${ICON_BASE}/marker-shadow.png`,
        });
        LRef.current = L;
        map = L.map(divRef.current).setView([-6.2, 106.8], 6);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        map.on("click", (e: any) => {
          if (!drawModeRef.current) return;
          const p: LatLng = [e.latlng.lat, e.latlng.lng];
          setPoints((prev) => [...prev, p]);
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Gagal memuat peta");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Render ulang layer setiap data/points berubah
  useEffect(() => {
    const L = LRef.current;
    const layer = layerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();
    const bounds: LatLng[] = [];

    // Coverage (lingkaran)
    for (const c of data?.coverages ?? []) {
      const cc = parseCoverageArea(c.area);
      if (!cc) continue;
      L.circle([cc.lat, cc.lng], {
        radius: cc.radius,
        color: "#0d627c",
        weight: 2,
        fillColor: "#0d627c",
        fillOpacity: 0.08,
      })
        .bindPopup(`<b>${esc(c.name)}</b>${c.description ? `<br>${esc(c.description)}` : ""}<br><span style="color:#64748b">Radius ±${Math.round(cc.radius / 1000)} km</span>`)
        .addTo(layer);
      bounds.push([cc.lat, cc.lng]);
    }

    // Kabel fiber
    for (const cb of cables) {
      if (Array.isArray(cb.path) && cb.path.length >= 2) {
        L.polyline(cb.path, { color: cb.color || "#0d627c", weight: 4, opacity: 0.85 })
          .bindPopup(`<b>Kabel: ${esc(cb.name)}</b>${cb.notes ? `<br>${esc(cb.notes)}` : ""}`)
          .addTo(layer);
        for (const p of cb.path) bounds.push(p);
      }
    }

    // ODC (biru)
    for (const o of data?.odcs ?? []) {
      const la = num(o.latitude);
      const lo = num(o.longitude);
      if (la === null || lo === null) continue;
      L.circleMarker([la, lo], { radius: 9, color: "#1d4ed8", weight: 2, fillColor: "#3b82f6", fillOpacity: 0.9 })
        .bindPopup(`<b>ODC: ${esc(o.name)}</b><br>Kapasitas: ${o.capacity ?? "-"} port${o.address ? `<br>${esc(o.address)}` : ""}`)
        .addTo(layer);
      bounds.push([la, lo]);
    }

    // ODP (hijau)
    for (const o of data?.odps ?? []) {
      const la = num(o.latitude);
      const lo = num(o.longitude);
      if (la === null || lo === null) continue;
      L.circleMarker([la, lo], { radius: 7, color: "#15803d", weight: 2, fillColor: "#22c55e", fillOpacity: 0.9 })
        .bindPopup(`<b>ODP: ${esc(o.name)}</b><br>Kapasitas: ${o.capacity ?? "-"} port${o.address ? `<br>${esc(o.address)}` : ""}`)
        .addTo(layer);
      bounds.push([la, lo]);
    }

    // Pelanggan (warna by status)
    for (const c of data?.customers ?? []) {
      const la = num(c.latitude);
      const lo = num(c.longitude);
      if (la === null || lo === null) continue;
      const col = statusColor(c.status);
      L.circleMarker([la, lo], { radius: 6, color: col, weight: 2, fillColor: col, fillOpacity: 0.85 })
        .bindPopup(
          `<b>${esc(c.name)}</b> (${esc(c.code ?? "-")})<br>` +
            `Status: ${esc(c.status ?? "-")}${c.package_name ? `<br>Paket: ${esc(c.package_name)}` : ""}${c.phone ? `<br>${esc(c.phone)}` : ""}`
        )
        .addTo(layer);
      bounds.push([la, lo]);
    }

    // Titik gambar kabel (sementara)
    if (points.length > 0) {
      for (const p of points) {
        L.circleMarker(p, { radius: 5, color: "#f97316", weight: 2, fillColor: "#fb923c", fillOpacity: 1 }).addTo(layer);
      }
      if (points.length >= 2) {
        L.polyline(points, { color: form.color, weight: 4, dashArray: "8 6" }).addTo(layer);
      }
    }

    if (bounds.length > 0 && mapRef.current) {
      try {
        mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
      } catch {
        /* abaikan */
      }
    }
  }, [data, cables, points, form.color]);

  async function saveCable() {
    if (!form.name.trim()) {
      setErr("Nama kabel wajib diisi");
      return;
    }
    if (points.length < 2) {
      setErr("Klik minimal 2 titik di peta");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await api("/api/map/cables", {
        method: "POST",
        body: JSON.stringify({ name: form.name.trim(), color: form.color, path: points }),
      });
      setPoints([]);
      setForm({ name: "", color: "#0d627c" });
      setDrawMode(false);
      const c = await api<{ cables: Cable[] }>("/api/map/cables");
      setCables(c.cables ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan kabel");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCable(id: number) {
    if (!confirm("Hapus kabel ini dari peta?")) return;
    try {
      await api(`/api/map/cables/${id}`, { method: "DELETE" });
      setCables((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menghapus kabel");
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2">
        <div className="card !p-2">
          <div ref={divRef} className="w-full h-[65vh] min-h-[420px] rounded-xl z-0" />
          {loading && (
            <p className="text-center text-sm text-slate-400 py-3">Memuat peta…</p>
          )}
        </div>
        {/* legenda */}
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500 px-1">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> ODC</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> ODP</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" /> Pelanggan aktif</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-600 inline-block" /> Isolir</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-600 inline-block" /> Pending</span>
          <span className="flex items-center gap-1.5"><span className="w-6 h-1 bg-brand-500 inline-block rounded" /> Kabel fiber</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-brand-500 bg-brand-500/10 inline-block" /> Cakupan</span>
        </div>
      </div>

      <div className="space-y-5">
        <div className="card">
          <h3 className="font-bold text-slate-900 mb-1">Gambar Kabel</h3>
          <p className="text-xs text-slate-500 mb-4">
            Aktifkan mode gambar, lalu klik 2 titik atau lebih di peta untuk membuat jalur kabel fiber.
          </p>
          {!drawMode ? (
            <button className="btn-primary w-full" onClick={() => { setDrawMode(true); setPoints([]); }}>
              + Mulai Gambar Kabel
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-brand-600">
                Mode gambar aktif — klik peta ({points.length} titik)
              </p>
              <div>
                <label className="label">Nama kabel</label>
                <input
                  className="input"
                  placeholder="cth: Backbone ODC-A → ODP-12"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Warna</label>
                <input
                  type="color"
                  className="w-full h-10 rounded-xl border border-slate-200 cursor-pointer"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={saving} onClick={saveCable}>
                  {saving ? "Menyimpan…" : "Simpan Kabel"}
                </button>
                <button
                  className="btn-outline"
                  disabled={saving || points.length === 0}
                  onClick={() => setPoints((p) => p.slice(0, -1))}
                >
                  Undo
                </button>
                <button
                  className="btn-outline"
                  onClick={() => { setDrawMode(false); setPoints([]); }}
                >
                  Batal
                </button>
              </div>
            </div>
          )}
          {err && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</p>}
        </div>

        <div className="card">
          <h3 className="font-bold text-slate-900 mb-3">Daftar Kabel ({cables.length})</h3>
          {cables.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada kabel. Gambar jalur fiber pertama Anda.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {cables.map((c) => (
                <li key={c.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100">
                  <span className="w-8 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 truncate">{c.name}</span>
                    <span className="block text-xs text-slate-400">{c.path?.length ?? 0} titik</span>
                  </span>
                  <button
                    className="text-xs font-semibold text-red-600 hover:underline px-2 py-1"
                    onClick={() => deleteCable(c.id)}
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3 className="font-bold text-slate-900 mb-2">Ringkasan</h3>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-slate-500">ODC</dt><dd className="font-bold">{data?.odcs.length ?? "-"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">ODP</dt><dd className="font-bold">{data?.odps.length ?? "-"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Pelanggan berkoordinat</dt><dd className="font-bold">{data?.customers.length ?? "-"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Area cakupan</dt><dd className="font-bold">{data?.coverages.length ?? "-"}</dd></div>
          </dl>
          <button className="btn-outline w-full mt-4" onClick={reload}>Muat Ulang Data</button>
        </div>
      </div>
    </div>
  );
}
