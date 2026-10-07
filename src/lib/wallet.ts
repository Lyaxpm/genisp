import type { Sql } from "./db";

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
  const rows = await db`select * from wallet_accounts where owner_type = ${ownerType} and owner_id = ${ownerId}`;
  if (rows.length) return rows[0] as unknown as WalletRow;
  const ins = await db`insert into wallet_accounts (owner_type, owner_id)
    values (${ownerType}, ${ownerId}) returning *`;
  return ins[0] as unknown as WalletRow;
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
  if (!amount || amount <= 0) throw new Error("Nominal harus lebih dari 0");
  const rows = await db`update wallet_accounts
    set balance = balance + ${amount}, updated_at = now()
    where id = ${walletId} returning balance`;
  if (!rows.length) throw new Error("Wallet tidak ditemukan");
  const balanceAfter = Number(rows[0].balance);
  await db`insert into wallet_ledger (wallet_id, direction, amount, balance_after, reference_type, reference_id, description, created_by)
    values (${walletId}, 'credit', ${amount}, ${balanceAfter},
      ${referenceType ?? null}, ${referenceId ?? null}, ${description ?? null}, ${createdBy ?? null})`;
  return balanceAfter;
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
  if (!amount || amount <= 0) throw new Error("Nominal harus lebih dari 0");
  const rows = await db`update wallet_accounts
    set balance = balance - ${amount}, updated_at = now()
    where id = ${walletId} and balance >= ${amount} returning balance`;
  if (!rows.length) throw new Error("Saldo wallet tidak mencukupi");
  const balanceAfter = Number(rows[0].balance);
  await db`insert into wallet_ledger (wallet_id, direction, amount, balance_after, reference_type, reference_id, description, created_by)
    values (${walletId}, 'debit', ${amount}, ${balanceAfter},
      ${referenceType ?? null}, ${referenceId ?? null}, ${description ?? null}, ${createdBy ?? null})`;
  return balanceAfter;
}

/** Riwayat ledger sebuah wallet. */
export async function getLedger(db: Sql, walletId: number, limit = 50): Promise<LedgerRow[]> {
  const rows = await db`select * from wallet_ledger where wallet_id = ${walletId}
    order by id desc limit ${limit}`;
  return rows as unknown as LedgerRow[];
}
