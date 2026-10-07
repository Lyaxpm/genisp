import { NextRequest } from "next/server";
import { sql, type Sql } from "@/lib/db";
import { trySendWhatsapp } from "@/lib/notify";
import { ok, fail, fillTemplate, periodLabel, rupiah, todayID } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getSetting(db: Sql, key: string): Promise<string> {
  const rows = await db`select value from settings where key = ${key}`;
  return (rows[0]?.value as string) ?? "";
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return fail("Unauthorized", 401);
  const db = sql();
  const tpl =
    (await getSetting(db, "wa_reminder_h3")) ||
    "Halo {nama}, tagihan {kode} periode {periode} sebesar {jumlah} jatuh tempo {jatuh_tempo}. Mohon segera dibayar. Terima kasih.";

  const rows = await db`select i.code, i.period, i.amount, i.due_date, c.name as customer_name, c.phone as customer_phone
    from invoices i join customers c on c.id = i.customer_id
    where i.status = 'unpaid' and i.due_date = current_date + interval '3 days'
      and c.phone is not null and c.phone <> ''`;
  let queued = 0;
  for (const r of rows) {
    const msg = fillTemplate(tpl, {
      nama: String(r.customer_name),
      kode: String(r.code),
      periode: periodLabel(String(r.period)),
      jumlah: rupiah(r.amount),
      jatuh_tempo: todayID(r.due_date as string),
    });
    try {
      await trySendWhatsapp(String(r.customer_phone), msg);
      queued++;
    } catch {
      /* abaikan */
    }
  }
  return ok({ checked: rows.length, queued });
}
