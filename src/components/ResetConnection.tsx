"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";

/** Kartu kecil "Reset Koneksi" untuk portal member: kick sesi PPPoE/hotspot di MikroTik. */
export default function ResetConnection() {
  const [type, setType] = useState<"pppoe" | "hotspot">("pppoe");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function doReset() {
    if (!confirm(`Putuskan sesi ${type === "pppoe" ? "PPPoE" : "hotspot"} Anda sekarang?`)) return;
    setLoading(true);
    setMsg(null);
    try {
      const d = await api<{ kicked: boolean; note: string }>("/api/portal/reset", {
        method: "POST",
        body: JSON.stringify({ type }),
      });
      setMsg({ ok: d.kicked, text: d.note });
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : "Gagal mereset koneksi",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card animate-fade-up" style={{ animationDelay: "260ms" }}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h2 className="font-bold text-slate-900">Reset Koneksi</h2>
          <p className="text-sm text-slate-500 mt-0.5 max-w-xl">
            Internet lambat atau tidak bisa konek? Putuskan sesi Anda di server, lalu sambungkan ulang dari perangkat.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            className="input !w-auto"
            value={type}
            onChange={(e) => setType(e.target.value as "pppoe" | "hotspot")}
            aria-label="Tipe koneksi"
          >
            <option value="pppoe">PPPoE</option>
            <option value="hotspot">Hotspot</option>
          </select>
          <button className="btn-primary" disabled={loading} onClick={doReset}>
            {loading ? "Memproses…" : "Reset Sekarang"}
          </button>
        </div>
      </div>
      {msg && (
        <p
          className={`mt-3 text-sm rounded-xl px-3 py-2 ${
            msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
