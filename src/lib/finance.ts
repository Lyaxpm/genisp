import type { Sql } from "./db";

// Ambil id kategori pemasukan berdasarkan nama; buat jika belum ada.
export async function getOrCreateIncomeCategory(db: Sql, name: string): Promise<number> {
  const rows = await db`select id from income_categories where name = ${name}`;
  if (rows.length) return rows[0].id as number;
  const ins = await db`insert into income_categories (name) values (${name}) returning id`;
  return ins[0].id as number;
}

export async function getOrCreateExpenditureCategory(db: Sql, name: string): Promise<number> {
  const rows = await db`select id from expenditure_categories where name = ${name}`;
  if (rows.length) return rows[0].id as number;
  const ins = await db`insert into expenditure_categories (name) values (${name}) returning id`;
  return ins[0].id as number;
}
