import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function rupiah(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return "Rp " + v.toLocaleString("id-ID");
}

export function todayID(d?: Date | string): string {
  const dt = d ? new Date(d) : new Date();
  return dt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function periodLabel(period: string): string {
  // "2026-10" -> "Oktober 2026"
  const [y, m] = period.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, 1);
  return dt.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export function invoiceCode(prefix: string, date = new Date(), seq: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${prefix}/${y}/${m}/${String(seq).padStart(4, "0")}`;
}

export function randomCode(len = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) s += chars[buf[i] % chars.length];
  return s;
}
