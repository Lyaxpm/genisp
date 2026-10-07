import { NextRequest } from "next/server";
import { sql, type Sql } from "@/lib/db";
import { trySendWhatsapp } from "@/lib/notify";
import { isolirCustomer } from "@/lib/mikrotik-actions";
import { ok, fail, fillTemplate, rupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getSetting(db: Sql, key: string): Promise<string> {
  const rows = await db`select value from settings where key = ${key}`;
  return (rows[0]?.value as string) ?? "";
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return fail("Unauthorized", 401);
  const db = sql();
  const days = parseInt((await getSetting(db, "auto_isolir_days")) || "3", 10) || 0;
  const tpl =
    (await getSetting(db, "wa_overdue")) ||
    "Halo {nama}, tagihan {kode} sebesar {jumlah} sudah melewati jatuh tempo. Layanan Anda diisolir sementara. Segera lakukan pembayaran. Terima kasih.";

  const rows = await db`select i.code, i.amount, c.id as customer_id, c.name as customer_name, c.phone as customer_phone
    from invoices i join customers c on c.id = i.customer_id
    where i.status = 'unpaid'
      and i.due_date < current_date - make_interval(days => ${days})
      and c.status = 'aktif' and c.auto_isolir = true`;
  let isolated = 0;
  let rosOk = 0;
  for (const r of rows) {
    // Isolir penuh: nonaktifkan user di router (best-effort) + set status DB.
    try {
      const res = await isolirCustomer(db, Number(r.customer_id));
      if (res.router === "ok") rosOk++;
    } catch {
      // jangan gagalkan cron; status tetap diisolir di bawah
      await db`update customers set status = 'isolir', updated_at = now() where id = ${r.customer_id}`;
    }
    isolated++;
    if (r.customer_phone) {
      const msg = fillTemplate(tpl, {
        nama: String(r.customer_name),
        kode: String(r.code),
        jumlah: rupiah(r.amount),
      });
      try {
        await trySendWhatsapp(String(r.customer_phone), msg);
      } catch {
        /* abaikan */
      }
    }
  }
  try {
    await db`insert into activity_logs (action, detail)
      values ('cron:auto-isolir', ${`checked=${rows.length} isolated=${isolated} ros_ok=${rosOk} days=${days}`})`;
  } catch {
    /* abaikan */
  }
  return ok({ checked: rows.length, isolated, rosOk });
}
