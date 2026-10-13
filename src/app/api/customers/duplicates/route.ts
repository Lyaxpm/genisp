import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Deteksi duplikat pelanggan. Aturan (deterministik, terdokumentasi):
 *
 * 1. "phone"            — nomor HP sama setelah dinormalisasi:
 *                         buang non-digit, lalu samakan format lokal (0...)
 *                         dari varian "628…", "62 8…", "+628…", "8…".
 * 2. "name"             — nama sama setelah dinormalisasi (huruf kecil,
 *                         hanya alfanumerik + spasi, spasi diringkas).
 * 3. "similar_name"     — kemiripan nama >= 0.75 (trigram Jaccard)
 *                         tanpa cocok pada aturan 1–2.
 * 4. "name_and_address" — nama mirip (>= 0.6 trigram) DAN alamat mirip
 *                         (>= 0.4 trigram).
 *
 * Pencarian nama mirip memakai blocking: pasangan hanya dibandingkan bila
 * 4 karakter pertama nama yang dinormalisasi sama (menghindari O(n²) penuh).
 */

type Cust = { id: number; code: string; name: string; phone: string | null; address: string | null };

function normPhone(p: string | null): string {
  if (!p) return "";
  let d = p.replace(/\D/g, "");
  if (d.startsWith("62")) d = "0" + d.slice(2);
  else if (d.startsWith("8")) d = "0" + d;
  return d.length >= 8 ? d : "";
}

function normText(t: string | null): string {
  if (!t) return "";
  return t
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(s: string): Set<string> {
  const set = new Set<string>();
  const padded = `  ${s} `;
  for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const t of Array.from(small)) if (big.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const maxPairs = Math.min(500, Math.max(1, parseInt(sp.get("limit") ?? "100", 10) || 100));
  const db = sql();

  const rows = (await db`select id, code, name, phone, address from customers
    where deleted_at is null order by id desc limit 5000`) as Cust[];

  const pairs: { rule: string; score: number; a: Cust; b: Cust }[] = [];
  const seen = new Set<string>();
  const key = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`);

  // Aturan 1: nomor HP sama
  const byPhone = new Map<string, Cust[]>();
  for (const c of rows) {
    const p = normPhone(c.phone);
    if (!p) continue;
    if (!byPhone.has(p)) byPhone.set(p, []);
    byPhone.get(p)!.push(c);
  }
  for (const group of Array.from(byPhone.values())) {
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) {
        const k = key(group[i].id, group[j].id);
        seen.add(k);
        pairs.push({ rule: "phone", score: 1, a: group[i], b: group[j] });
      }
  }

  // Aturan 2: nama persis sama
  const byName = new Map<string, Cust[]>();
  for (const c of rows) {
    const n = normText(c.name);
    if (!n) continue;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n)!.push(c);
  }
  for (const group of Array.from(byName.values())) {
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) {
        const k = key(group[i].id, group[j].id);
        if (seen.has(k)) continue;
        seen.add(k);
        pairs.push({ rule: "name", score: 1, a: group[i], b: group[j] });
      }
  }

  // Aturan 3 & 4: nama mirip (dengan blocking 4 karakter pertama)
  const cache = new Map<number, Set<string>>();
  const nameOf = (c: Cust) => {
    let t = cache.get(c.id);
    if (!t) {
      t = trigrams(normText(c.name));
      cache.set(c.id, t);
    }
    return t;
  };
  const addrOf = (c: Cust) => trigrams(normText(c.address));

  const blocks = new Map<string, Cust[]>();
  for (const c of rows) {
    const n = normText(c.name);
    if (n.length < 4) continue;
    const blk = n.slice(0, 4);
    if (!blocks.has(blk)) blocks.set(blk, []);
    blocks.get(blk)!.push(c);
  }
  for (const group of Array.from(blocks.values())) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) {
        const k = key(group[i].id, group[j].id);
        if (seen.has(k)) continue;
        const nameSim = jaccard(nameOf(group[i]), nameOf(group[j]));
        if (nameSim >= 0.75) {
          seen.add(k);
          pairs.push({ rule: "similar_name", score: Number(nameSim.toFixed(3)), a: group[i], b: group[j] });
        } else if (nameSim >= 0.6) {
          const addrSim = jaccard(addrOf(group[i]), addrOf(group[j]));
          if (addrSim >= 0.4) {
            seen.add(k);
            pairs.push({
              rule: "name_and_address",
              score: Number(((nameSim + addrSim) / 2).toFixed(3)),
              a: group[i],
              b: group[j],
            });
          }
        }
      }
  }

  const order: Record<string, number> = { phone: 0, name: 1, similar_name: 2, name_and_address: 3 };
  pairs.sort((x, y) => order[x.rule] - order[y.rule] || y.score - x.score);

  return ok({ total: pairs.length, pairs: pairs.slice(0, maxPairs) });
}
