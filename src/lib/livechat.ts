// Livechat: token pengunjung + hub pub/sub IN-MEMORY untuk SSE.
//
// KNOWN LIMITATION (jujur, jangan dihapus):
// Pub/sub di bawah ini hidup di memori SATU instance server. Di Vercel
// serverless bisa ada banyak instance yang berjalan bersamaan, sehingga
// pesan yang diterbitkan dari instance A tidak terlihat oleh subscriber SSE
// yang tersambung ke instance B. Ini pengganti socket.io PTA — socket.io
// butuh koneksi stateful yang tidak cocok untuk serverless, dan SSE adalah
// kompromi yang realistis. Untuk realtime sempurna lintas instance, ganti hub
// ini dengan adapter Redis pub/sub (mis. Upstash Redis, sudah dipakai proyek
// ini untuk queue) atau polling pendek sebagai fallback.
import { randomBytes, timingSafeEqual } from "crypto";
import { sql, Sql } from "@/lib/db";

export type Conversation = {
  id: number;
  visitor_name: string;
  visitor_contact: string | null;
  visitor_token: string;
  status: "open" | "closed";
  assigned_to: number | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type ChatMessage = {
  id: number;
  conversation_id: number;
  sender: "visitor" | "staff";
  staff_name: string | null;
  message: string;
  created_at: string;
};

/** Buat token percakapan acak (64 hex chars). Tidak disimpan di mana pun selain DB. */
export function newVisitorToken(): string {
  return randomBytes(32).toString("hex");
}

/** Ambil percakapan + verifikasi token pengunjung (constant-time bila panjang sama). */
export async function getConversationByToken(
  db: Sql,
  id: number,
  token: string
): Promise<Conversation | null> {
  const rows = (await db`select * from livechat_conversations where id = ${id}`) as Conversation[];
  const conv = rows[0];
  if (!conv || !token) return null;
  const a = Buffer.from(token);
  const b = Buffer.from(conv.visitor_token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return conv;
}

/** Ambil semua pesan satu percakapan (urutan kronologis). */
export async function getMessages(db: Sql, conversationId: number): Promise<ChatMessage[]> {
  return (await db`select id, conversation_id, sender, staff_name, message, created_at
    from livechat_messages
    where conversation_id = ${conversationId}
    order by id asc`) as ChatMessage[];
}

/** Sisipkan pesan + publikasikan ke subscriber SSE instance ini. */
export async function insertMessage(
  db: Sql,
  conversationId: number,
  sender: "visitor" | "staff",
  message: string,
  staffName: string | null = null
): Promise<ChatMessage> {
  const rows = (await db`insert into livechat_messages (conversation_id, sender, staff_name, message)
    values (${conversationId}, ${sender}, ${staffName}, ${message})
    returning id, conversation_id, sender, staff_name, message, created_at`) as ChatMessage[];
  const msg = rows[0];
  publishChatEvent(conversationId, { type: "message", data: msg });
  return msg;
}

// ---------------------------------------------------------------------------
// Hub pub/sub in-memory: Map<conversationId, Set<listener>>.
// Lihat KNOWN LIMITATION di header file ini.
// ---------------------------------------------------------------------------
type ChatEvent =
  | { type: "message"; data: ChatMessage }
  | { type: "status"; data: { conversation_id: number; status: string } };

type Listener = (ev: ChatEvent) => void;

const hub = new Map<number, Set<Listener>>();

export function subscribe(conversationId: number, fn: Listener): () => void {
  let set = hub.get(conversationId);
  if (!set) {
    set = new Set();
    hub.set(conversationId, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) hub.delete(conversationId);
  };
}

export function publishChatEvent(conversationId: number, ev: ChatEvent): void {
  const set = hub.get(conversationId);
  if (!set) return;
  set.forEach((fn) => {
    try {
      fn(ev);
    } catch {
      /* abaikan listener rusak */
    }
  });
}
