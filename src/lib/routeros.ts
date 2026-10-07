// Klien minimal RouterOS API (MikroTik) via TCP.
// Implementasi word-length encoding sesuai protokol resmi RouterOS API.
// Dipakai untuk test koneksi; login + apiCommand tersedia untuk kebutuhan lain.
import { createConnection, Socket } from "node:net";
import { createHash } from "node:crypto";

function encodeLen(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x4000) return Buffer.from([(len >> 8) | 0x80, len & 0xff]);
  if (len < 0x200000) return Buffer.from([(len >> 16) | 0xc0, (len >> 8) & 0xff, len & 0xff]);
  if (len < 0x10000000)
    return Buffer.from([(len >> 24) | 0xe0, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  return Buffer.from([0xf0, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
}

/** Test koneksi TCP ke API port router. */
export async function testConnection(
  host: string,
  port = 8728,
  timeoutMs = 5000
): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        sock.destroy();
      } catch {
        /* abaikan */
      }
      resolve({ ok, latencyMs: Date.now() - start });
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const sock = createConnection({ host, port });
    sock.on("connect", () => finish(true));
    sock.on("error", () => finish(false));
  });
}

type TalkResult = { ok: boolean; reply: string[]; data: string[][] };

class RosApi {
  private sock!: Socket;
  private buf = Buffer.alloc(0);
  private waiters: Array<() => void> = [];
  private closed = false;

  connect(host: string, port: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        try {
          this.sock?.destroy();
        } catch {
          /* abaikan */
        }
        reject(new Error("Timeout koneksi ke router"));
      }, timeoutMs);
      this.sock = createConnection({ host, port }, () => {
        clearTimeout(timer);
        resolve();
      });
      this.sock.on("data", (d: Buffer) => {
        this.buf = Buffer.concat([this.buf, d]);
        this.waiters.splice(0).forEach((f) => f());
      });
      this.sock.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      this.sock.on("close", () => {
        this.closed = true;
        this.waiters.splice(0).forEach((f) => f());
      });
    });
  }

  private async readBytes(n: number): Promise<Buffer> {
    while (this.buf.length < n) {
      if (this.closed) throw new Error("Koneksi router terputus");
      await new Promise<void>((r) => this.waiters.push(r));
    }
    const out = this.buf.subarray(0, n);
    this.buf = this.buf.subarray(n);
    return out;
  }

  private async readLen(): Promise<number> {
    const b0 = (await this.readBytes(1))[0];
    if (b0 < 0x80) return b0;
    if (b0 < 0xc0) return ((b0 & 0x3f) << 8) | (await this.readBytes(1))[0];
    if (b0 < 0xe0) {
      const b = await this.readBytes(2);
      return ((b0 & 0x1f) << 16) | (b[0] << 8) | b[1];
    }
    if (b0 < 0xf0) {
      const b = await this.readBytes(3);
      return ((b0 & 0x0f) << 24) | (b[0] << 16) | (b[1] << 8) | b[2];
    }
    const b = await this.readBytes(4);
    return (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3];
  }

  async readSentence(): Promise<string[]> {
    const words: string[] = [];
    for (;;) {
      const len = await this.readLen();
      if (len === 0) return words;
      words.push((await this.readBytes(len)).toString("utf8"));
    }
  }

  async writeSentence(words: string[]): Promise<void> {
    const parts = words.map((w) => {
      const b = Buffer.from(w, "utf8");
      return Buffer.concat([encodeLen(b.length), b]);
    });
    parts.push(Buffer.from([0]));
    const data = Buffer.concat(parts);
    await new Promise<void>((resolve, reject) =>
      this.sock.write(data, (e) => (e ? reject(e) : resolve()))
    );
  }

  async talk(words: string[]): Promise<TalkResult> {
    await this.writeSentence(words);
    const data: string[][] = [];
    for (;;) {
      const s = await this.readSentence();
      if (s[0] === "!done") return { ok: true, reply: s, data };
      if (s[0] === "!trap" || s[0] === "!fatal") return { ok: false, reply: s, data };
      if (s[0] === "!re") data.push(s);
    }
  }

  close() {
    try {
      this.sock?.destroy();
    } catch {
      /* abaikan */
    }
  }
}

/** Login ke RouterOS API. Coba gaya baru (>=6.43), fallback ke challenge-response MD5. */
export async function rosLogin(
  host: string,
  port: number,
  username: string,
  password: string,
  timeoutMs = 8000
): Promise<RosApi> {
  const api = new RosApi();
  await api.connect(host, port, timeoutMs);
  try {
    const modern = await api.talk(["/login", `=name=${username}`, `=password=${password}`]);
    if (modern.ok) return api;
    const ret = modern.reply.find((w) => w.startsWith("=ret="))?.slice(5) ?? "";
    if (!ret) throw new Error("Login gagal: kredensial salah");
    const challenge = Buffer.from(ret, "hex");
    const digest = createHash("md5")
      .update(Buffer.concat([Buffer.from([0]), Buffer.from(password, "utf8"), challenge]))
      .digest("hex");
    const legacy = await api.talk(["/login", `=name=${username}`, `=response=00${digest}`]);
    if (!legacy.ok) throw new Error("Login gagal: kredensial salah");
    return api;
  } catch (e) {
    api.close();
    throw e;
  }
}

/** Jalankan satu perintah API generik, mis. apiCommand(h,p,u,pw,["/ppp/secret/print"]). */
export async function apiCommand(
  host: string,
  port: number,
  username: string,
  password: string,
  words: string[],
  timeoutMs = 10000
): Promise<TalkResult> {
  const api = await rosLogin(host, port, username, password, timeoutMs);
  try {
    return await api.talk(words);
  } finally {
    api.close();
  }
}

/* ================== Ekstensi aksi MikroTik ================== */

/** Tipe koneksi login aktif (hasil rosLogin). */
export type RosConn = Awaited<ReturnType<typeof rosLogin>>;
export type RosResult = TalkResult;

export type RouterRow = {
  id: number;
  host: string;
  api_port?: number | null;
  username: string;
  password_enc?: string | null;
};

/** Ambil pesan error dari reply !trap. */
export function trapMessage(reply: string[]): string {
  const m = reply.find((w) => w.startsWith("=message="));
  return m ? m.slice(9) : "perintah ditolak router";
}

/** Cari .id entitas lewat print dengan filter tunggal. */
export async function findId(
  conn: RosConn,
  path: string,
  key: string,
  val: string
): Promise<string | null> {
  const r = await conn.talk([`${path}/print`, `?${key}=${val}`]);
  if (!r.ok || r.data.length === 0) return null;
  const idWord = r.data[0].find((w) => w.startsWith("=.id="));
  return idWord ? idWord.slice(5) : null;
}

/** Ubah baris-baris !re menjadi objek {key: value}. */
export function rowsToObjects(data: string[][]): Record<string, string>[] {
  return data.map((row) => {
    const o: Record<string, string> = {};
    for (const w of row) {
      if (w === "!re" || !w.startsWith("=")) continue;
      const i = w.indexOf("=", 1);
      if (i > 0) o[w.slice(1, i)] = w.slice(i + 1);
    }
    return o;
  });
}

/** Koneksi login ke router dari baris DB (password_enc tersimpan base64). */
export async function connectRouter(r: RouterRow, timeoutMs = 10000): Promise<RosConn> {
  const password = r.password_enc ? Buffer.from(String(r.password_enc), "base64").toString("utf8") : "";
  return rosLogin(r.host, r.api_port ?? 8728, r.username, password, timeoutMs);
}

/* ---------- PPP secrets ---------- */

export async function pppSecretAdd(
  conn: RosConn,
  o: { name: string; password: string; profile?: string; service?: string; comment?: string }
): Promise<void> {
  const words = ["/ppp/secret/add", `=name=${o.name}`, `=password=${o.password}`];
  if (o.profile) words.push(`=profile=${o.profile}`);
  if (o.service) words.push(`=service=${o.service}`);
  if (o.comment) words.push(`=comment=${o.comment}`);
  const r = await conn.talk(words);
  if (!r.ok) throw new Error(`Gagal menambah PPP secret "${o.name}": ${trapMessage(r.reply)}`);
}

export async function pppSecretSet(
  conn: RosConn,
  name: string,
  params: Record<string, string>
): Promise<void> {
  const id = await findId(conn, "/ppp/secret", "name", name);
  if (!id) throw new Error(`PPP secret "${name}" tidak ditemukan di router`);
  const words = [`/ppp/secret/set`, `=.id=${id}`];
  for (const [k, v] of Object.entries(params)) words.push(`=${k}=${v}`);
  const r = await conn.talk(words);
  if (!r.ok) throw new Error(`Gagal mengubah PPP secret "${name}": ${trapMessage(r.reply)}`);
}

async function setDisabled(conn: RosConn, path: string, name: string, disable: boolean): Promise<void> {
  const id = await findId(conn, path, "name", name);
  if (!id) throw new Error(`Entitas "${name}" tidak ditemukan di ${path}`);
  const r = await conn.talk([`${path}/${disable ? "disable" : "enable"}`, `=.id=${id}`]);
  if (!r.ok)
    throw new Error(`Gagal ${disable ? "menonaktifkan" : "mengaktifkan"} "${name}": ${trapMessage(r.reply)}`);
}

export const pppSecretDisable = (conn: RosConn, name: string): Promise<void> =>
  setDisabled(conn, "/ppp/secret", name, true);
export const pppSecretEnable = (conn: RosConn, name: string): Promise<void> =>
  setDisabled(conn, "/ppp/secret", name, false);

export async function pppSecretRemove(conn: RosConn, name: string): Promise<void> {
  const id = await findId(conn, "/ppp/secret", "name", name);
  if (!id) return; // sudah tidak ada → anggap sukses
  const r = await conn.talk(["/ppp/secret/remove", `=.id=${id}`]);
  if (!r.ok) throw new Error(`Gagal menghapus PPP secret "${name}": ${trapMessage(r.reply)}`);
}

/** Tendang sesi PPP aktif. Return false bila user sedang offline (best-effort). */
export async function pppActiveRemove(conn: RosConn, name: string): Promise<boolean> {
  const id = await findId(conn, "/ppp/active", "name", name);
  if (!id) return false;
  const r = await conn.talk(["/ppp/active/remove", `=.id=${id}`]);
  return r.ok;
}

/* ---------- Hotspot users ---------- */

export async function hotspotUserAdd(
  conn: RosConn,
  o: { name: string; password: string; profile?: string; limitUptime?: string; comment?: string }
): Promise<void> {
  const words = ["/ip/hotspot/user/add", `=name=${o.name}`, `=password=${o.password}`];
  if (o.profile) words.push(`=profile=${o.profile}`);
  if (o.limitUptime) words.push(`=limit-uptime=${o.limitUptime}`);
  if (o.comment) words.push(`=comment=${o.comment}`);
  const r = await conn.talk(words);
  if (!r.ok) throw new Error(`Gagal menambah hotspot user "${o.name}": ${trapMessage(r.reply)}`);
}

export const hotspotUserDisable = (conn: RosConn, name: string): Promise<void> =>
  setDisabled(conn, "/ip/hotspot/user", name, true);
export const hotspotUserEnable = (conn: RosConn, name: string): Promise<void> =>
  setDisabled(conn, "/ip/hotspot/user", name, false);

export async function hotspotUserRemove(conn: RosConn, name: string): Promise<void> {
  const id = await findId(conn, "/ip/hotspot/user", "name", name);
  if (!id) return;
  const r = await conn.talk(["/ip/hotspot/user/remove", `=.id=${id}`]);
  if (!r.ok) throw new Error(`Gagal menghapus hotspot user "${name}": ${trapMessage(r.reply)}`);
}

/** Tendang sesi hotspot aktif. Return false bila user sedang offline (best-effort). */
export async function hotspotActiveRemove(conn: RosConn, name: string): Promise<boolean> {
  const id = await findId(conn, "/ip/hotspot/active", "user", name);
  if (!id) return false;
  const r = await conn.talk(["/ip/hotspot/active/remove", `=.id=${id}`]);
  return r.ok;
}

/* ---------- Address list ---------- */

export async function addressListAdd(
  conn: RosConn,
  list: string,
  address: string,
  comment?: string
): Promise<void> {
  const words = ["/ip/firewall/address-list/add", `=list=${list}`, `=address=${address}`];
  if (comment) words.push(`=comment=${comment}`);
  const r = await conn.talk(words);
  if (!r.ok) throw new Error(`Gagal menambah address-list: ${trapMessage(r.reply)}`);
}

export async function addressListRemove(conn: RosConn, list: string, address: string): Promise<void> {
  const r = await conn.talk(["/ip/firewall/address-list/print", `?list=${list}`]);
  if (!r.ok) return;
  for (const o of rowsToObjects(r.data)) {
    if (o.address === address && o[".id"]) {
      await conn.talk(["/ip/firewall/address-list/remove", `=.id=${o[".id"]}`]);
    }
  }
}

/* ---------- Monitoring ---------- */

export async function getInterfaces(conn: RosConn): Promise<Record<string, string>[]> {
  const r = await conn.talk(["/interface/print"]);
  if (!r.ok) throw new Error(`Gagal membaca interface: ${trapMessage(r.reply)}`);
  return rowsToObjects(r.data);
}

export async function getSystemResource(conn: RosConn): Promise<Record<string, string>> {
  const r = await conn.talk(["/system/resource/print"]);
  if (!r.ok) throw new Error(`Gagal membaca system resource: ${trapMessage(r.reply)}`);
  return rowsToObjects(r.data)[0] ?? {};
}
