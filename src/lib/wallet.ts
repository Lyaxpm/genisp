import type { Db as Sql, Sql as RootSql } from "./db";

export type OwnerType = "customer" | "partner";

export type WalletRow = {
  id: number;
  owner_type: string;
  owner_id: number;
  balance: number | string;
  points: number | string;
};

export type LedgerRow = {
  id: number;
  wallet_id: number;
  direction: "credit" | "debit";
  amount: number | string;
  balance_after: number | string;
  reference_type: string | null;
  reference_id: number | null;
  description: string | null;
  created_at: string;
};

/** Ambil wallet milik owner; buat otomatis bila belum ada. */
export async function getOrCreateWallet(
  db: Sql,
  ownerType: OwnerType,
  ownerId: number
): Promise<WalletRow> {
  const rows = await db`insert into wallet_accounts (owner_type, owner_id)
    values (${ownerType}, ${ownerId}) on conflict (owner_type, owner_id)
    do update set owner_id = excluded.owner_id returning *`;
  return rows[0] as unknown as WalletRow;
}

/** Tambah saldo + catat ledger. Return balance_after. */
export async function creditWallet(
  db: Sql,
  walletId: number,
  amount: number,
  referenceType?: string,
  referenceId?: number,
  description?: string,
  createdBy?: number | null
): Promise<number> {
  if (!Number.isFinite(amount) || amount < 0.01 || amount >= 1e12 || Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001)
    throw new Error("Nominal harus positif, finite, dan maksimal 2 desimal");
  // A data-modifying CTE is one SQL statement: balance and ledger commit or fail together.
  const rows = await db`with changed as (
    update wallet_accounts set balance = balance + ${amount}, updated_at = now()
    where id = ${walletId} returning id, balance
  ) insert into wallet_ledger (wallet_id, direction, amount, balance_after, reference_type, reference_id, description, created_by)
    select id, 'credit', ${amount}, balance, ${referenceType ?? null}, ${referenceId ?? null},
      ${description ?? null}, ${createdBy ?? null} from changed returning balance_after`;
  if (!rows.length) throw new Error("Wallet tidak ditemukan atau saldo tidak mencukupi");
  return Number(rows[0].balance_after);
}

/** Kurangi saldo (atomik, gagal bila saldo kurang) + catat ledger. Return balance_after. */
export async function debitWallet(
  db: Sql,
  walletId: number,
  amount: number,
  referenceType?: string,
  referenceId?: number,
  description?: string,
  createdBy?: number | null
): Promise<number> {
  if (!Number.isFinite(amount) || amount < 0.01 || amount >= 1e12 || Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001)
    throw new Error("Nominal harus positif, finite, dan maksimal 2 desimal");
  // A data-modifying CTE is one SQL statement: balance and ledger commit or fail together.
  const rows = await db`with changed as (
    update wallet_accounts set balance = balance - ${amount}, updated_at = now()
    where id = ${walletId} and balance >= ${amount} returning id, balance
  ) insert into wallet_ledger (wallet_id, direction, amount, balance_after, reference_type, reference_id, description, created_by)
    select id, 'debit', ${amount}, balance, ${referenceType ?? null}, ${referenceId ?? null},
      ${description ?? null}, ${createdBy ?? null} from changed returning balance_after`;
  if (!rows.length) throw new Error("Wallet tidak ditemukan atau saldo tidak mencukupi");
  return Number(rows[0].balance_after);
}

/** Riwayat ledger sebuah wallet. */
export async function getLedger(db: Sql, walletId: number, limit = 50): Promise<LedgerRow[]> {
  const rows = await db`select * from wallet_ledger where wallet_id = ${walletId}
    order by id desc limit ${limit}`;
  return rows as unknown as LedgerRow[];
}

/** Verify a pending top-up exactly once, including its balance and ledger. */
export async function settleWalletTopup(db: RootSql, topupId: number, staffId: number, staffName: string) {
  return db.begin(async tx => {
    const [topup] = await tx`select * from wallet_topups where id = ${topupId} for update`;
    if (!topup) throw new Error("Topup tidak ditemukan");
    if (topup.status === "paid") return { already: true };
    if (topup.status !== "pending") throw new Error("Topup tidak dalam status pending");
    const balanceAfter = await creditWallet(tx, Number(topup.wallet_id), Number(topup.amount), "topup", Number(topup.id), `Topup saldo (verifikasi ${staffName})`, staffId);
    await tx`update wallet_topups set status = 'paid', paid_at = now() where id = ${topup.id}`;
    return { settled: true, balance_after: balanceAfter };
  });
}
