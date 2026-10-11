// Singleton koneksi Postgres (aman untuk serverless Vercel).
// Pakai DATABASE_URL dari environment.
import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __genisp_sql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL belum diisi. Lihat .env.example");
  }
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export function sql() {
  if (!global.__genisp_sql) {
    global.__genisp_sql = createClient();
  }
  return global.__genisp_sql;
}

export type Sql = ReturnType<typeof sql>;

export type TransactionSql = postgres.TransactionSql;
export type Db = Sql | TransactionSql;
