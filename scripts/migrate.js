const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const postgres = require("postgres");
require("dotenv").config();

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diisi di .env");
  const db = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    await db.begin(async tx => {
      await tx`select pg_advisory_xact_lock(718491002)`;
      await tx`create table if not exists schema_migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())`;
      const dir = path.join(__dirname, "..", "supabase", "migrations");
      for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) {
        const content = fs.readFileSync(path.join(dir, file), "utf8");
        const checksum = crypto.createHash("sha256").update(content).digest("hex");
        const [applied] = await tx`select checksum from schema_migrations where name = ${file}`;
        if (applied) {
          if (applied.checksum !== checksum) throw new Error(`Migrasi ${file} berubah setelah diterapkan. Tambahkan file migrasi baru.`);
          continue;
        }
        await tx.unsafe(content);
        await tx`insert into schema_migrations (name, checksum) values (${file}, ${checksum})`;
        console.log(`OK ${file}`);
      }
    });
    console.log("Migrasi selesai.");
  } finally { await db.end(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
