// Adapter Telecore (WA blast).
// Konfigurasi 100% dari env: TELECORE_BASE_URL + TELECORE_API_KEY.
// Bila env belum diisi, THROW error jelas — tidak pernah mengembalikan
// respons palsu/sukses bohongan.

export type TelecoreResult = {
  sent: boolean;
  messageId?: string;
};

function config(): { baseUrl: string; apiKey: string } {
  const baseUrl = (process.env.TELECORE_BASE_URL ?? "").replace(/\/+$/, "");
  const apiKey = process.env.TELECORE_API_KEY ?? "";
  if (!baseUrl || !apiKey) {
    throw new Error("Telecore belum dikonfigurasi (isi TELECORE_BASE_URL dan TELECORE_API_KEY)");
  }
  return { baseUrl, apiKey };
}

/** Kirim satu pesan WA via Telecore. */
export async function sendTelecore(to: string, message: string): Promise<TelecoreResult> {
  const { baseUrl, apiKey } = config();
  if (!to.trim()) throw new Error("Tujuan (to) wajib diisi");
  if (!message.trim()) throw new Error("Pesan wajib diisi");

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/v1/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ to, message }),
    });
  } catch (e) {
    throw new Error(`Telecore tidak dapat dihubungi: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Telecore HTTP ${res.status}${txt ? `: ${txt.slice(0, 200)}` : ""}`);
  }
  const j = (await res.json().catch(() => null)) as { message_id?: string; id?: string } | null;
  return { sent: true, messageId: j?.message_id ?? j?.id };
}

/** Kirim pesan yang sama ke banyak tujuan (blast). Mengembalikan ringkasan. */
export async function sendTelecoreBlast(
  recipients: string[],
  message: string
): Promise<{ total: number; sent: number; failed: { to: string; error: string }[] }> {
  const failed: { to: string; error: string }[] = [];
  let sent = 0;
  const unique = Array.from(new Set(recipients.map((r) => String(r).trim()).filter(Boolean)));
  for (const to of unique) {
    try {
      await sendTelecore(to, message);
      sent++;
    } catch (e) {
      failed.push({ to, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { total: unique.length, sent, failed };
}

/** Cek ketersediaan konfigurasi tanpa mengirim apa pun. */
export function telecoreConfigured(): boolean {
  return Boolean((process.env.TELECORE_BASE_URL ?? "").trim() && (process.env.TELECORE_API_KEY ?? "").trim());
}
