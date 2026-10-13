"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Msg = {
  id: number;
  sender: "visitor" | "staff";
  staff_name: string | null;
  message: string;
  created_at: string;
};

type Saved = { id: number; token: string };

const LS_KEY = "genisp_livechat";

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.id === "number" && typeof v?.token === "string") return v;
  } catch {
    /* abaikan */
  }
  return null;
}

/**
 * Widget livechat publik (tanpa login).
 *
 * Cara pasang: import komponen ini lalu render di halaman publik yang diinginkan,
 * mis. di layout halaman depan:
 *
 *   import LiveChatWidget from "@/components/LiveChatWidget";
 *   ...
 *   <LiveChatWidget />
 *
 * Widget sengaja TIDAK dipasang otomatis di layout publik agar tidak muncul
 * di halaman yang tidak diinginkan. Bubble mengambang fixed di kanan bawah.
 *
 * Realtime memakai SSE (EventSource) ke /api/realtime/events. Lihat KNOWN
 * LIMITATION di src/lib/livechat.ts — realtime in-memory per instance, tidak
 * sempurna lintas instance Vercel.
 */
export default function LiveChatWidget() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSaved(loadSaved());
  }, []);

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => {
      boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
    });
  }, []);

  // Muat riwayat + buka stream SSE setiap kali percakapan aktif berubah / dibuka.
  useEffect(() => {
    if (!saved || !open) return;
    let es: EventSource | null = null;
    let alive = true;
    setErr("");

    (async () => {
      const r = await fetch(
        `/api/livechat/conversations/${saved.id}?token=${encodeURIComponent(saved.token)}`
      );
      const j = await r.json().catch(() => null);
      if (!alive) return;
      if (!j?.ok) {
        // Token kadaluarsa/tidak valid → buang sesi tersimpan.
        localStorage.removeItem(LS_KEY);
        setSaved(null);
        setMsgs([]);
        return;
      }
      setMsgs(j.data.messages ?? []);
      setStatus(j.data.conversation.status ?? "open");
      scrollBottom();

      es = new EventSource(
        `/api/realtime/events?conversation_id=${saved.id}&token=${encodeURIComponent(saved.token)}`
      );
      es.addEventListener("message", (e) => {
        try {
          const m = JSON.parse(e.data) as Msg;
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          scrollBottom();
        } catch {
          /* abaikan payload rusak */
        }
      });
      es.addEventListener("status", (e) => {
        try {
          const d = JSON.parse(e.data) as { status: string };
          if (d.status === "closed") setStatus("closed");
        } catch {
          /* abaikan */
        }
      });
    })();

    return () => {
      alive = false;
      es?.close();
    };
  }, [saved, open, scrollBottom]);

  async function startConversation() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/livechat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor_name: name.trim() || "Pengunjung", visitor_contact: contact.trim() }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) throw new Error(j?.error || "Gagal memulai percakapan");
      const v: Saved = { id: j.data.id, token: j.data.visitor_token };
      localStorage.setItem(LS_KEY, JSON.stringify(v));
      setSaved(v);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memulai percakapan");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || !saved || busy || status === "closed") return;
    setBusy(true);
    setDraft("");
    try {
      const r = await fetch(`/api/livechat/conversations/${saved.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${saved.token}`,
        },
        body: JSON.stringify({ message: text }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) throw new Error(j?.error || "Gagal mengirim pesan");
      // Pesan sendiri langsung ditampilkan; SSE akan mengabaikan duplikat by id.
      setMsgs((prev) => [...prev, j.data as Msg]);
      scrollBottom();
    } catch (e) {
      setDraft(text);
      setErr(e instanceof Error ? e.message : "Gagal mengirim pesan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 9999 }}>
      {open && (
        <div
          style={{
            width: 320,
            maxWidth: "calc(100vw - 32px)",
            height: 440,
            maxHeight: "70vh",
            background: "#fff",
            border: "1px solid #d4d4d4",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,.18)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              background: "#1e293b",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <strong style={{ fontSize: 14 }}>Live Chat</strong>
            <button
              onClick={() => setOpen(false)}
              aria-label="Tutup chat"
              style={{ background: "none", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" }}
            >
              ×
            </button>
          </div>

          {!saved ? (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 13, color: "#555", margin: 0 }}>
                Halo! Ada yang bisa kami bantu? Isi nama lalu mulai chat.
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama Anda"
                style={inputStyle}
              />
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="No. HP / email (opsional)"
                style={inputStyle}
              />
              {err && <p style={{ color: "#b91c1c", fontSize: 12, margin: 0 }}>{err}</p>}
              <button onClick={startConversation} disabled={busy} style={btnStyle}>
                {busy ? "Memulai..." : "Mulai Chat"}
              </button>
            </div>
          ) : (
            <>
              <div ref={boxRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {msgs.length === 0 && (
                  <p style={{ fontSize: 12, color: "#888", textAlign: "center" }}>
                    Percakapan dimulai. Silakan tulis pesan Anda.
                  </p>
                )}
                {msgs.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.sender === "visitor" ? "flex-end" : "flex-start",
                      background: m.sender === "visitor" ? "#2563eb" : "#f1f5f9",
                      color: m.sender === "visitor" ? "#fff" : "#111",
                      borderRadius: 10,
                      padding: "8px 10px",
                      fontSize: 13,
                      maxWidth: "85%",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {m.sender === "staff" && (
                      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>
                        {m.staff_name || "Staff"}
                      </div>
                    )}
                    {m.message}
                  </div>
                ))}
              </div>
              {status === "closed" ? (
                <div style={{ padding: 12, fontSize: 12, color: "#888", textAlign: "center", borderTop: "1px solid #eee" }}>
                  Percakapan ini telah ditutup oleh staff.
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid #eee" }}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Tulis pesan..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={send} disabled={busy || !draft.trim()} style={btnStyle}>
                    Kirim
                  </button>
                </div>
              )}
              {err && <p style={{ color: "#b91c1c", fontSize: 12, margin: 0, padding: "0 12px 8px" }}>{err}</p>}
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Tutup live chat" : "Buka live chat"}
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: "#2563eb",
          color: "#fff",
          fontSize: 24,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,.25)",
          float: "right",
        }}
      >
        {open ? "×" : "💬"}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid #d4d4d4",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
};

const btnStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
