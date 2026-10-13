import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fail, fillTemplate, rupiah, periodLabel, todayID } from "@/lib/utils";

export const dynamic = "force-dynamic";

function stripToThermal(html: string): string {
  // Render template HTML sederhana menjadi teks struk 58mm.
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/(p|div|tr|h\d)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((l) => l.replace(/\s+$/g, "").slice(0, 32)) // kertas 58mm ~ 32 kolom
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Cetak struk 58mm dari template (bawaan atau kustom).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const id = Number(params.id);
  const tplId = req.nextUrl.searchParams.get("template_id");
  const db = sql();

  const inv = (
    await db`select i.*, c.name as customer_name, c.code as customer_code, c.phone as customer_phone, c.address as customer_address
      from invoices i join customers c on c.id = i.customer_id where i.id = ${id}`
  )[0];
  if (!inv) return fail("Invoice tidak ditemukan", 404);
  const items = await db`select * from invoice_items where invoice_id = ${id} order by id asc`;
  const comp = (await db`select * from company where id = 1`)[0];

  const tpl = tplId
    ? (await db`select * from receipt_templates where id = ${Number(tplId)}`)[0]
    : (await db`select * from receipt_templates where kind = 'thermal' and is_default order by id desc limit 1`)[0];
  if (!tpl) return fail("Template struk tidak ditemukan", 404);

  const itemLines = items
    .map((it) => {
      const line = `${String(it.description)}`.slice(0, 32);
      const sub = `${it.qty}x ${rupiah(it.price)}`;
      return `${line}\n${sub}`;
    })
    .join("\n");

  const vars: Record<string, string> = {
    company_name: String(comp?.name ?? "GenISP"),
    company_phone: String(comp?.phone ?? ""),
    company_address: String(comp?.address ?? ""),
    invoice_code: inv.code,
    issued_at: todayID(inv.created_at),
    period: periodLabel(inv.period),
    due_date: String(inv.due_date),
    customer_name: inv.customer_name,
    customer_code: inv.customer_code ?? "",
    customer_phone: inv.customer_phone ?? "",
    customer_address: inv.customer_address ?? "",
    items: itemLines,
    amount: rupiah(inv.amount),
    discount: rupiah(inv.discount ?? 0),
    unique_code: String(inv.unique_code ?? 0),
    unique_amount: rupiah(inv.unique_amount ?? inv.amount),
    status: inv.status === "paid" ? "LUNAS" : "BELUM BAYAR",
    paid_note: inv.status === "paid" ? `Lunas pada ${todayID(inv.paid_at)} via ${inv.payment_method ?? "-"}` : "",
  };

  const text = stripToThermal(fillTemplate(tpl.body_html, vars));
  return new NextResponse(text, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
