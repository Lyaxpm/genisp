import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type VoucherCard = { username: string; password: string; profile: string };

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fillPlaceholders(html: string, v: VoucherCard): string {
  return html
    .replace(/\{\{\s*username\s*\}\}/g, esc(v.username))
    .replace(/\{\{\s*password\s*\}\}/g, esc(v.password))
    .replace(/\{\{\s*profile\s*\}\}/g, esc(v.profile));
}

const PAGE_CSS: Record<string, string> = {
  A4: "@page { size: A4; margin: 8mm; }",
  A5: "@page { size: A5; margin: 8mm; }",
  "80mm": "@page { size: 80mm auto; margin: 0; }",
  "58mm": "@page { size: 58mm auto; margin: 0; }",
};

// GET /api/hotspot/templates/[id]/print
// Render template HTML siap cetak. Data voucher dikirim lewat query, TIDAK disimpan di DB.
// Format: ?username=..&password=..&profile=..&qty=..  ATAU  ?data=[{"username":..,"password":..,"profile":..}]
// Contoh: GET /api/hotspot/templates/3/print?data=%5B%7B%22username%22%3A%22ABC%22%7D%5D
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const db = sql();
  const rows = await db`select * from hotspot_voucher_templates where id = ${Number(params.id)}`;
  if (!rows.length)
    return NextResponse.json({ ok: false, error: "Template tidak ditemukan" }, { status: 404 });
  const tpl = rows[0] as Record<string, unknown>;
  const sp = req.nextUrl.searchParams;

  const cards: VoucherCard[] = [];
  const raw = sp.get("data");
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const it of arr.slice(0, 500)) {
          cards.push({
            username: String(it?.username ?? ""),
            password: String(it?.password ?? it?.username ?? ""),
            profile: String(it?.profile ?? ""),
          });
        }
      }
    } catch {
      return NextResponse.json({ ok: false, error: "Parameter data bukan JSON valid" }, { status: 400 });
    }
  } else {
    const username = sp.get("username") ?? "";
    const qty = Math.min(500, Math.max(1, parseInt(sp.get("qty") ?? "1", 10) || 1));
    if (!username)
      return NextResponse.json(
        { ok: false, error: "Sertakan ?data=... atau ?username=...&password=...&profile=..." },
        { status: 400 }
      );
    for (let i = 0; i < qty; i++) {
      cards.push({
        username,
        password: sp.get("password") ?? username,
        profile: sp.get("profile") ?? "",
      });
    }
  }
  if (!cards.length)
    return NextResponse.json({ ok: false, error: "Tidak ada data voucher" }, { status: 400 });

  const body = cards.map((c) => fillPlaceholders(String(tpl.html_body ?? ""), c)).join("\n");
  const size = String(tpl.paper_size ?? "A4");
  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
<title>Cetak Voucher - ${esc(String(tpl.name ?? ""))}</title>
<style>
${PAGE_CSS[size] ?? PAGE_CSS.A4}
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 8mm; }
.voucher-card { page-break-inside: avoid; margin-bottom: 6px; }
@media print { body { padding: 0; } }
</style></head>
<body>
${body}
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</script>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
