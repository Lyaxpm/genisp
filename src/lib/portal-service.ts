// Helper bersama route portal member (STREAM S10).
// Isolasi ketat: semua data diambil dari session member -> customers.id = session.id.
import { NextRequest, NextResponse } from "next/server";
import { sql, type Sql } from "./db";
import { getSession, type SessionUser } from "./auth";
import { connectRouter, type RosConn } from "./routeros";
import { fail } from "./utils";

export type MemberServiceRow = {
  id: number;
  code: string;
  name: string;
  email: string | null;
  connection_type: string;
  status: string;
  router_id: number | null;
  pppoe_user: string | null;
  pppoe_pass: string | null;
  mac_address: string | null;
  odp_id: number | null;
  odp_port: number | null;
  r_host: string | null;
  r_name: string | null;
  r_port: number | null;
  r_user: string | null;
  r_pass: string | null;
  r_is_cpe: boolean | null;
  package_name: string | null;
  speed_down: string | number | null;
  speed_up: string | number | null;
};

export type MemberCtx = {
  db: Sql;
  session: SessionUser;
  cust: MemberServiceRow;
  ip: string | null;
};

/** Wajib login sebagai member; ambil baris service miliknya sendiri (join router+paket). */
export async function requireMemberService(
  req: NextRequest
): Promise<{ ctx: MemberCtx } | { error: NextResponse }> {
  const s = await getSession();
  if (!s || s.kind !== "member") return { error: fail("Unauthorized", 401) };
  const db = sql();
  const rows = await db`select c.id, c.code, c.name, c.email, c.connection_type, c.status,
      c.router_id, c.pppoe_user, c.pppoe_pass, c.mac_address, c.odp_id, c.odp_port,
      r.host as r_host, r.name as r_name, r.api_port as r_port, r.username as r_user,
      r.password_enc as r_pass, r.is_cpe as r_is_cpe,
      p.name as package_name, p.speed_down, p.speed_up
    from customers c
    left join routers r on r.id = c.router_id
    left join packages p on p.id = c.package_id
    where c.id = ${s.id}`;
  if (!rows.length) return { error: fail("Data pelanggan tidak ditemukan", 404) };
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  return { ctx: { db, session: s, cust: rows[0] as unknown as MemberServiceRow, ip } };
}

/** Catat aktivitas portal member (user_id null karena actor adalah customer, bukan staff). */
export async function logMemberActivity(
  db: Sql,
  cust: MemberServiceRow,
  action: string,
  detail: string,
  ip: string | null
) {
  await db`insert into activity_logs (action, detail, ip)
    values (${action}, ${`[member customer_id=${cust.id} code=${cust.code}] ${detail}`}, ${ip})`;
}

/** Koneksi login RouterOS ke router milik pelanggan. Lempar bila belum terpasang. */
export async function connectOwnRouter(cust: MemberServiceRow): Promise<RosConn> {
  if (!cust.router_id || !cust.r_host) throw new Error("Layanan belum dipasangkan router");
  return connectRouter({
    id: Number(cust.router_id),
    host: String(cust.r_host),
    api_port: cust.r_port ? Number(cust.r_port) : 8728,
    username: String(cust.r_user ?? ""),
    password_enc: String(cust.r_pass ?? ""),
  });
}

/** Username koneksi milik pelanggan (pppoe_user fallback ke code). */
export function ownLoginName(cust: MemberServiceRow): string {
  return String(cust.pppoe_user || cust.code || "").trim();
}
