import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { creditWallet, debitWallet, getOrCreateWallet, settleWalletTopup } from "../src/lib/wallet";
import { settleInTransaction, payInvoiceManually } from "../src/lib/settle";
import { defaultPermission, hasPermission } from "../src/lib/permissions";
import type { Sql } from "../src/lib/db";

const engine = new PGlite();
// Execute application SQL against the embedded PostgreSQL engine. PGlite serializes
// transactions; production multi-connection row-lock behavior needs a PostgreSQL integration environment.
function adapter(connection: any): any {
  const tag: any = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const text = parts.reduce((s, part, i) => s + (i ? `$${i}` : "") + part, "");
    return (await connection.query(text, values)).rows;
  };
  tag.begin = (fn: (tx: any) => unknown) => connection.transaction((tx: any) => fn(adapter(tx)));
  tag.unsafe = async (text: string, values: unknown[] = []) => (await connection.query(text, values)).rows;
  return tag;
}
const db: Sql = adapter(engine);

before(async () => {
  for (const name of readdirSync("supabase/migrations").filter(x => x.endsWith(".sql")).sort()) {
    // pgcrypto is unused in this schema and not bundled with the WASM engine.
    await engine.exec(readFileSync(`supabase/migrations/${name}`, "utf8").replace('create extension if not exists "pgcrypto";', ""));
  }
  await db`insert into customers (code, name, phone) values ('TEST1', 'Test Customer', '000')`;
});
after(() => engine.close());

async function invoice(amount = 100) {
  const [row] = await db`insert into invoices (code, customer_id, period, amount, due_date)
    values (${crypto.randomUUID()}, 1, '2026-10', ${amount}, current_date) returning *`;
  return row;
}
async function payment(invoiceId: number, gateway = "test", amount = 100) {
  const [row] = await db`insert into payments (invoice_id, gateway, amount) values (${invoiceId}, ${gateway}, ${amount}) returning *`;
  return row;
}

test("all migrations execute; re-running legacy seed does not duplicate packages", async () => {
  const [before] = await db`select count(*)::int as n from packages`;
  await engine.exec(readFileSync("supabase/migrations/002_seed.sql", "utf8"));
  const [after] = await db`select count(*)::int as n from packages`;
  assert.equal(after.n, before.n);
});

test("wallet balance and ledger roll back together when ledger insertion fails", async () => {
  const w = await getOrCreateWallet(db, "customer", 1);
  await assert.rejects(creditWallet(db, w.id, 100, "test", undefined, "Invalid staff", 999999));
  const [row] = await db`select balance from wallet_accounts where id = ${w.id}`;
  assert.equal(Number(row.balance), 0);
  await creditWallet(db, w.id, 150);
  await assert.rejects(debitWallet(db, w.id, 151));
  assert.equal(await debitWallet(db, w.id, 50), 100);
  await assert.rejects(creditWallet(db, w.id, Infinity));
});

test("repeated callbacks and different payments for one invoice create one income", async () => {
  const inv = await invoice();
  const p = await payment(inv.id);
  const second = await payment(inv.id);
  const results = await Promise.all([p, p, second].map(row => db.begin(tx => settleInTransaction(tx, row.id))));
  assert.equal(results.filter(r => !r.already).length, 1);
  const rows = await db`select * from incomes where description = ${"Pembayaran " + inv.code}`;
  assert.equal(rows.length, 1);
  const [review] = await db`select status from payments where id = ${second.id}`;
  assert.equal(review.status, "review");
});

test("failure after updating payment rolls back payment, invoice, and wallet", async () => {
  const inv = await invoice(60);
  const p = await payment(inv.id, "wallet", 60);
  const [w] = await db`select * from wallet_accounts where owner_type = 'customer' and owner_id = 1`;
  await engine.exec("alter table incomes add constraint test_reject_income check (amount <> 60)");
  await assert.rejects(db.begin(tx => settleInTransaction(tx, p.id)));
  const [pay] = await db`select status from payments where id = ${p.id}`;
  const [bill] = await db`select status from invoices where id = ${inv.id}`;
  const [wallet] = await db`select balance from wallet_accounts where id = ${w.id}`;
  assert.equal(pay.status, "pending"); assert.equal(bill.status, "unpaid");
  assert.equal(Number(wallet.balance), Number(w.balance));
  await engine.exec("alter table incomes drop constraint test_reject_income");
});

test("wallet payment cannot debit twice, and insufficient funds leave invoice unpaid", async () => {
  const inv = await invoice(70);
  const p = await payment(inv.id, "wallet", 70);
  await db.begin(tx => settleInTransaction(tx, p.id));
  await db.begin(tx => settleInTransaction(tx, p.id));
  const [w] = await db`select balance from wallet_accounts where owner_type = 'customer' and owner_id = 1`;
  assert.equal(Number(w.balance), 30);
  const another = await invoice(100);
  const anotherPay = await payment(another.id, "wallet");
  await assert.rejects(db.begin(tx => settleInTransaction(tx, anotherPay.id)));
  const [state] = await db`select status from payments where id = ${anotherPay.id}`;
  assert.equal(state.status, "pending");
});

test("manual payment rejects underpayment and repeated manual settlement is idempotent", async () => {
  const inv = await invoice();
  await assert.rejects(db.begin(tx => payInvoiceManually(tx, inv.id, 50, "transfer")));
  const first = await db.begin(tx => payInvoiceManually(tx, inv.id, 100, "tunai"));
  const second = await db.begin(tx => payInvoiceManually(tx, inv.id, 100, "tunai"));
  assert.equal(first.already, false); assert.equal(second.already, true);
});

test("permissions deny sensitive modules by default and obey explicit rules", async () => {
  assert.equal(defaultPermission("cs", "wallet"), false);
  assert.equal(defaultPermission("teknisi", "pengaturan"), false);
  assert.equal(defaultPermission("teknisi", "genieacs"), true);
  assert.equal(defaultPermission("unknown", "dashboard"), false);
  global.__genisp_sql = db;
  await db`insert into role_permissions (role, menu_key, allowed) values ('teknisi', 'genieacs', false)`;
  assert.equal(await hasPermission("teknisi", "genieacs"), false);
  global.__genisp_sql = (() => { throw new Error("DB offline"); }) as unknown as Sql;
  assert.equal(await hasPermission("admin", "wallet"), false);
  global.__genisp_sql = undefined;
});

test("duplicate topup approval credits once and a failed ledger leaves topup pending", async () => {
  const wallet = await getOrCreateWallet(db, "customer", 9);
  const [topup] = await db`insert into wallet_topups (wallet_id, amount) values (${wallet.id}, 200) returning id`;
  await assert.rejects(settleWalletTopup(db, topup.id, 999999, "Invalid"));
  const [pending] = await db`select status from wallet_topups where id = ${topup.id}`;
  assert.equal(pending.status, "pending");
  const outcomes = await Promise.all([1, 2].map(() => settleWalletTopup(db, topup.id, 1, "Admin")));
  assert.equal(outcomes.filter(x => x.settled).length, 1);
  const [balance] = await db`select balance from wallet_accounts where id = ${wallet.id}`;
  assert.equal(Number(balance.balance), 200);
});
