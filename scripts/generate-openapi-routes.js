/**
 * generate-openapi-routes.js
 * STREAM S5 — Dokumentasi OpenAPI (setara Documentation.php PTA).
 *
 * Memindai src/app/api/[..]/route.ts (rekursif), mengekstrak named export HTTP
 * (GET/POST/PUT/PATCH/DELETE), lalu menulis manifest statis ke
 * src/lib/openapi-routes.json yang dikonsumsi src/lib/openapi.ts.
 *
 * Jalankan ulang setiap kali ada route baru/berubah:
 *   node scripts/generate-openapi-routes.js
 *
 * Tidak menambah dependensi npm; murni Node bawaan.
 */
const fs = require("fs");
const path = require("path");

const API_DIR = path.join(__dirname, "..", "src", "app", "api");
const OUT_FILE = path.join(__dirname, "..", "src", "lib", "openapi-routes.json");

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
// Mendeteksi: export async function GET( / export function POST( / export const GET =
const EXPORT_RE = /export\s+(?:async\s+)?(?:function\s+|const\s+)(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name === "route.ts") acc.push(full);
  }
  return acc;
}

function dirToPath(routeFile) {
  const rel = path.relative(API_DIR, path.dirname(routeFile)).split(path.sep).join("/");
  // Konversi segment dinamis Next.js [id] -> {id} (OpenAPI), termasuk catch-all [...slug]
  const openapiPath = "/api/" + rel
    .split("/")
    .map((seg) => {
      const m = seg.match(/^\[(\.\.\.)?([^\]]+)\]$/);
      return m ? `{${m[2]}}` : seg;
    })
    .join("/");
  const pathParams = [];
  for (const seg of rel.split("/")) {
    const m = seg.match(/^\[(\.\.\.)?([^\]]+)\]$/);
    if (m) pathParams.push(m[2]);
  }
  return { openapiPath, pathParams, group: rel.split("/")[0] };
}

const files = walk(API_DIR, []).sort();
const routes = [];

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const methods = new Set();
  let m;
  EXPORT_RE.lastIndex = 0;
  while ((m = EXPORT_RE.exec(src)) !== null) methods.add(m[1]);
  if (methods.size === 0) continue; // route tanpa handler HTTP: abaikan
  const { openapiPath, pathParams, group } = dirToPath(file);
  routes.push({ path: openapiPath, group, methods: [...methods], pathParams });
}

const manifest = {
  generatedAt: new Date().toISOString(),
  generator: "scripts/generate-openapi-routes.js (STREAM S5)",
  count: routes.length,
  routes,
};

fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + "\n");
console.log(`OK: ${routes.length} route -> ${path.relative(process.cwd(), OUT_FILE)}`);
