// Runner migrasi sederhana: node scripts/migrate.js
// Menjalankan semua file .sql di supabase/migrations secara berurutan.
const fs = require("fs");
const path = require("path");
const postgres = require("postgres");
require("dotenv").config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL belum diisi di .env");
    process.exit(1);
  }
  const dir = path.join(__dirname, "..", "supabase", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const sql = postgres(url, { max: 1 });
  for (const f of files) {
    console.log("→", f);
    const content = fs.readFileSync(path.join(dir, f), "utf8");
    await sql.unsafe(content);
    console.log("  OK");
  }
  await sql.end();
  console.log("Migrasi selesai.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
