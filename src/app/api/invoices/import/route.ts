import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Parser CSV sederhana (mendukung koma/semikolon + quoted field).
function parseCsv(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const delim = (lines[0].match(/;/g) ?? []).length > (lines[0].match(/,/g) ?? []).length ? ";" : ",";
  return lines.map((line) => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQ = false;
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  });
}

// Import invoice dari file CSV → dibuat sebagai draft, error dilaporkan per baris.
// Header yang dikenali: customer_code, period, amount, discount, due_date, notes, description
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return fail("Kirim file CSV sebagai form-data field 'file'", 400);
  const name = (file as File).name.toLowerCase();
  if (!name.endsWith(".csv")) return fail("Hanya file .csv yang didukung (tidak ada parser Excel di repo)", 400);

  const text = await (file as File).text();
  const rows = parseCsv(text);
  if (rows.length < 2) return fail("CSV kosong atau tidak ada baris data", 400);

  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z_]/g, ""));
  const need = ["customer_code", "period", "amount"];
  const missing = need.filter((c) => !header.includes(c));
  if (missing.length) return fail(`Kolom wajib hilang: ${missing.join(", ")}`, 400);
  const idx = (c: string) => header.indexOf(c);

  const db = sql();
  const custRows = await db`select id, code from customers`;
  const byCode = new Map<string, number>();
  for (const c of custRows) byCode.set(String(c.code).toLowerCase(), c.id);

  const created: { row: number; draft_id: number; customer_code: string; period: string }[] = [];
  const errors: { row: number; error: string }[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const lineNo = r + 1;
    try {
      const customer_code = (row[idx("customer_code")] ?? "").trim();
      const period = (row[idx("period")] ?? "").trim();
      const amount = Number((row[idx("amount")] ?? "").replace(/[^0-9.\-]/g, ""));
      const discount = idx("discount") >= 0 ? Number((row[idx("discount")] ?? "0").replace(/[^0-9.\-]/g, "")) || 0 : 0;
      const due_date = idx("due_date") >= 0 ? (row[idx("due_date")] ?? "").trim() : "";
      const notes = idx("notes") >= 0 ? (row[idx("notes")] ?? "").trim() : "";
      const description = idx("description") >= 0 ? (row[idx("description")] ?? "").trim() : "";

      if (!customer_code) throw new Error("customer_code kosong");
      const customer_id = byCode.get(customer_code.toLowerCase());
      if (!customer_id) throw new Error(`Pelanggan '${customer_code}' tidak ditemukan`);
      if (!/^\d{4}-\d{2}$/.test(period)) throw new Error(`period '${period}' tidak valid (YYYY-MM)`);
      if (!amount || amount <= 0) throw new Error("amount tidak valid");
      if (discount < 0 || discount > amount) throw new Error("discount tidak valid");
      if (due_date && !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) throw new Error("due_date harus YYYY-MM-DD");

      const d = await db.begin(async (tx) => {
        const dr = (
          await tx`insert into invoice_drafts (customer_id, period, amount, discount, due_date, notes, created_by)
            values (${customer_id}, ${period}, ${amount}, ${discount}, ${due_date || null}, ${notes || null}, ${s.id})
            returning id`
        )[0];
        await tx`insert into invoice_draft_items (draft_id, description, qty, price)
          values (${dr.id}, ${description || `Tagihan periode ${period}`}, 1, ${amount})`;
        return dr;
      });
      created.push({ row: lineNo, draft_id: d.id, customer_code, period });
    } catch (e) {
      errors.push({ row: lineNo, error: (e as Error).message });
    }
  }

  return ok({ created: created.length, drafts: created, failed: errors.length, errors });
}
