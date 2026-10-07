"use client";

import { useEffect, useRef, useState } from "react";
import { haversine, parseCoverageArea } from "@/lib/geo";

type Coverage = { id: number | string; name: string; description?: string | null; area?: unknown };

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

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
    const s = document.createElement("script");
    s.src = LEAFLET_JS;
    s.onload = () => resolve((window as unknown as { L?: any }).L);
    s.onerror = () => reject(new Error("Peta gagal dimuat"));
    document.head.appendChild(s);
  });
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function CoverageMap({ coverages }: { coverages: Coverage[] }) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const meMarkerRef = useRef<any>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; name: string; distanceM: number }
    | { ok: false; reason: string }
    | null
  >(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const circles = coverages
    .map((c) => ({ c, cc: parseCoverageArea(c.area) }))
    .filter((x): x is { c: Coverage; cc: { lat: number; lng: number; radius: number } } => x.cc !== null);

  useEffect(() => {
    let map: any = null;
    let cancelled = false;
    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !divRef.current) return;
        map = L.map(divRef.current).setView([-6.2, 106.8], 6);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        mapRef.current = map;
        if (circles.length > 0) {
          const bounds = L.latLngBounds(circles.map((x) => [x.cc.lat, x.cc.lng] as [number, number]));
          map.fitBounds(bounds.pad(0.4));
        }
        for (const { c, cc } of circles) {
          L.circle([cc.lat, cc.lng], {
            radius: cc.radius,
            color: "#0d627c",
            weight: 2,
            fillColor: "#0d627c",
            fillOpacity: 0.12,
          })
            .bindPopup(`<b>${esc(c.name)}</b>${c.description ? `<br>${esc(c.description)}` : ""}`)
            .addTo(map);
        }
      } catch {
        /* abaikan */
      }
    })();
    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkLocation() {
    setGeoError(null);
    setResult(null);
    if (!("geolocation" in navigator)) {
      setGeoError("Browser Anda tidak mendukung geolokasi.");
      return;
    }
    setChecking(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const L = await loadLeaflet();
          const map = mapRef.current;
          if (map) {
            if (meMarkerRef.current) meMarkerRef.current.remove();
            meMarkerRef.current = L.marker([latitude, longitude])
              .bindPopup("<b>Lokasi Anda</b>")
              .addTo(map)
              .openPopup();
            map.setView([latitude, longitude], 12);
          }
        } catch {
          /* peta opsional */
        }
        let best: { name: string; distanceM: number } | null = null;
        for (const { c, cc } of circles) {
          const d = haversine(latitude, longitude, cc.lat, cc.lng);
          if (d <= cc.radius && (!best || d < best.distanceM)) {
            best = { name: c.name, distanceM: d };
          }
        }
        if (best) {
          setResult({ ok: true, name: best.name, distanceM: best.distanceM });
        } else {
          setResult({ ok: false, reason: "Lokasi Anda belum masuk area cakupan kami." });
        }
        setChecking(false);
      },
      () => {
        setGeoError("Tidak bisa membaca lokasi. Pastikan izin lokasi diaktifkan.");
        setChecking(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <div className="space-y-5">
      <div className="card !p-2">
        <div ref={divRef} className="w-full h-[60vh] min-h-[380px] rounded-xl z-0" />
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Cek ketersediaan di lokasi Anda</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Izinkan akses lokasi — kami hitung jaraknya langsung di perangkat Anda.
            </p>
          </div>
          <button className="btn-primary shrink-0" disabled={checking} onClick={checkLocation}>
            {checking ? "Membaca lokasi…" : "📍 Cek Lokasi Saya"}
          </button>
        </div>
        {geoError && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{geoError}</p>}
        {result && result.ok && (
          <div className="mt-4 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-5">
            <p className="font-extrabold text-emerald-700 text-lg">✅ Tercover!</p>
            <p className="text-sm text-emerald-700/80 mt-1">
              Lokasi Anda masuk area <b>{result.name}</b> (±{(result.distanceM / 1000).toFixed(1)} km dari titik pusat).
            </p>
          </div>
        )}
        {result && !result.ok && (
          <div className="mt-4 rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-5">
            <p className="font-extrabold text-amber-700 text-lg">Belum tercover</p>
            <p className="text-sm text-amber-700/80 mt-1">{result.reason} Hubungi kami — siapa tahu bisa diperluas.</p>
          </div>
        )}
      </div>
    </div>
  );
}
