"use client";

import { useEffect, useState } from "react";
import { api, asList } from "@/lib/api";
import { periodLabel, rupiah } from "@/lib/utils";

const W = 32; // lebar karakter struk 80mm
const line = "-".repeat(W);
const center = (s: string) => {
  const t = s.length >= W ? s.slice(0, W) : s;
  const pad = Math.floor((W - t.length) / 2);
  return " ".repeat(pad) + t;
};
const row = (l: string, r: string) => {
  const rr = r.length > 12 ? r.slice(0, 12) : r;
  const ll = l.length > W - rr.length - 1 ? l.slice(0, W - rr.length - 1) : l;
  return ll + " ".repeat(W - ll.length - rr.length) + rr;
};

function settingsToMap(d: any): Record<string, string> {
  const map: Record<string, string> = {};
  if (!d) return map;
  if (Array.isArray(d)) {
    for (const s of d) if (s?.key) map[String(s.key)] = String(s.value ?? "");
    return map;
  }
  const obj = d.settings ?? d.data ?? d;
  if (typeof obj === "object") for (const k of Object.keys(obj)) map[k] = String((obj as any)[k] ?? "");
  return map;
}

export default function ThermalPage({ params }: { params: { id: string } }) {
  const [inv, setInv] = useState<any>(null);
  const [company, setCompany] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [i, s] = await Promise.all([
          api<any>(`/api/invoices/${params.id}`),
          api<any>("/api/settings").catch(() => null),
        ]);
        setInv(i);
        setCompany(settingsToMap(s));
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [params.id]);

  useEffect(() => {
    if (inv && !printed) {
      setPrinted(true);
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [inv, printed]);

  if (error) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700">
        Gagal memuat invoice: {error}
      </div>
    );
  }
  if (!inv) return <p className="mt-10 text-center text-sm text-slate-400">Memuat struk...</p>;

  const cname = company.company_name || "GenISP";
  const caddr = company.company_address || "";
  const cphone = company.company_phone || "";
  const items = asList(inv.items);
  const total = Number(inv.amount ?? inv.total ?? 0);

  const body: string[] = [
    center(cname.toUpperCase()),
    ...(caddr ? [center(caddr)] : []),
    ...(cphone ? [center("Telp: " + cphone)] : []),
    line,
    row("No", String(inv.code ?? "-")),
    row("Periode", periodLabel(inv.period)),
    row("Tgl", String(inv.created_at ?? "").slice(0, 10)),
    row("Pelanggan", String(inv.customer_name ?? inv.customer?.name ?? "-").slice(0, 18)),
    line,
    ...items.flatMap((it: any) => [
      String(it.description ?? "Item").slice(0, W),
      row(`  x${it.qty ?? 1}`, rupiah(Number(it.price ?? 0) * Number(it.qty ?? 1))),
    ]),
    line,
    row("TOTAL", rupiah(total)),
    row("Status", String(inv.status ?? "-").toUpperCase()),
    line,
    center("Terima kasih atas"),
    center("pembayaran Anda"),
    center(""),
    center("*** Powered by GenISP ***"),
  ];

  return (
    <>
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .thermal { width: 80mm; margin: 0; padding: 2mm 3mm; }
        }
        @media screen {
          .thermal { width: 80mm; margin: 0 auto; background: #fff; border: 1px dashed #cbd5e1; padding: 8px 12px; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-xl items-center justify-between">
        <button type="button" onClick={() => window.history.back()} className="btn-outline !py-2 text-sm">
          Kembali
        </button>
        <button type="button" onClick={() => window.print()} className="btn-primary !py-2 text-sm">
          Cetak Thermal
        </button>
      </div>

      <pre className="thermal font-mono text-[11px] leading-[1.5] text-slate-900">{body.join("\n")}</pre>
    </>
  );
}
