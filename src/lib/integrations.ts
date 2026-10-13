// Katalog integrasi (stream S13).
// ATURAN KERAS: secret hanya hidup di environment variable. API tidak pernah
// mengembalikan nilai secret (hanya status "terisi"/"belum diset") dan PUT
// hanya menerima config non-secret yang disimpan di tabel settings.

export type IntegrationSecret = {
  key: string;
  label: string;
  env: string;
};

export type IntegrationConfigField = {
  key: string;
  label: string;
  type: "text" | "boolean" | "select";
  options?: string[];
  default?: string;
};

export type Integration = {
  key: string;
  name: string;
  description: string;
  secrets: IntegrationSecret[];
  config: IntegrationConfigField[];
};

export const INTEGRATIONS: Integration[] = [
  {
    key: "xendit",
    name: "Xendit",
    description: "Payment gateway — VA, QRIS, e-wallet, retail.",
    secrets: [
      { key: "secret_key", label: "Secret Key", env: "XENDIT_SECRET_KEY" },
      { key: "webhook_token", label: "Webhook Verification Token", env: "XENDIT_WEBHOOK_TOKEN" },
    ],
    config: [{ key: "enabled", label: "Aktif", type: "boolean", default: "false" }],
  },
  {
    key: "midtrans",
    name: "Midtrans",
    description: "Payment gateway — Snap / Core API.",
    secrets: [{ key: "server_key", label: "Server Key", env: "MIDTRANS_SERVER_KEY" }],
    config: [
      { key: "client_key", label: "Client Key (publik)", type: "text" },
      { key: "is_production", label: "Mode Production", type: "boolean", default: "false" },
      { key: "enabled", label: "Aktif", type: "boolean", default: "false" },
    ],
  },
  {
    key: "tripay",
    name: "Tripay",
    description: "Payment gateway — VA & gerai.",
    secrets: [
      { key: "api_key", label: "API Key", env: "TRIPAY_API_KEY" },
      { key: "private_key", label: "Private Key", env: "TRIPAY_PRIVATE_KEY" },
    ],
    config: [
      { key: "merchant_code", label: "Merchant Code", type: "text" },
      { key: "enabled", label: "Aktif", type: "boolean", default: "false" },
    ],
  },
  {
    key: "duitku",
    name: "Duitku",
    description: "Payment gateway — VA & QRIS.",
    secrets: [{ key: "api_key", label: "API Key", env: "DUITKU_API_KEY" }],
    config: [
      { key: "merchant_code", label: "Merchant Code", type: "text" },
      { key: "enabled", label: "Aktif", type: "boolean", default: "false" },
    ],
  },
  {
    key: "doku",
    name: "DOKU",
    description: "Payment gateway — VA & kartu.",
    secrets: [{ key: "secret_key", label: "Secret Key", env: "DOKU_SECRET_KEY" }],
    config: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "is_production", label: "Mode Production", type: "boolean", default: "false" },
      { key: "enabled", label: "Aktif", type: "boolean", default: "false" },
    ],
  },
  {
    key: "ipaymu",
    name: "iPaymu",
    description: "Payment gateway — VA iPaymu.",
    secrets: [{ key: "api_key", label: "API Key", env: "IPAYMU_API_KEY" }],
    config: [
      { key: "virtual_account", label: "Virtual Account", type: "text" },
      { key: "enabled", label: "Aktif", type: "boolean", default: "false" },
    ],
  },
  {
    key: "bni",
    name: "BNI e-Collection",
    description: "Virtual Account BNI langsung.",
    secrets: [{ key: "callback_token", label: "Callback Token", env: "BNI_CALLBACK_TOKEN" }],
    config: [
      { key: "va_prefix", label: "VA Prefix (cth: 988)", type: "text" },
      { key: "enabled", label: "Aktif", type: "boolean", default: "false" },
    ],
  },
  {
    key: "moota",
    name: "Moota",
    description: "Mutasi bank otomatis via webhook.",
    secrets: [{ key: "secret_key", label: "Webhook Secret", env: "MOOTA_SECRET_KEY" }],
    config: [{ key: "enabled", label: "Aktif", type: "boolean", default: "false" }],
  },
  {
    key: "flip",
    name: "Flip",
    description: "Disbursement & accept payment.",
    secrets: [{ key: "secret_key", label: "Secret Key", env: "FLIP_SECRET_KEY" }],
    config: [{ key: "enabled", label: "Aktif", type: "boolean", default: "false" }],
  },
  {
    key: "whatsapp",
    name: "WhatsApp Gateway",
    description: "Notifikasi WA — reminder, info bayar, isolir.",
    secrets: [{ key: "api_key", label: "API Key", env: "WHATSAPP_API_KEY" }],
    config: [
      { key: "api_url", label: "API URL", type: "text" },
      { key: "sender_number", label: "Nomor Pengirim", type: "text" },
      { key: "enabled", label: "Aktif", type: "boolean", default: "false" },
    ],
  },
  {
    key: "telegram",
    name: "Telegram Bot",
    description: "Notifikasi bot Telegram (detail di Pengaturan → Telegram).",
    secrets: [{ key: "bot_token", label: "Bot Token", env: "TELEGRAM_BOT_TOKEN" }],
    config: [{ key: "enabled", label: "Aktif", type: "boolean", default: "false" }],
  },
  {
    key: "email",
    name: "Email SMTP",
    description: "Notifikasi email (detail di Pengaturan → Email).",
    secrets: [{ key: "password", label: "SMTP Password", env: "SMTP_PASS" }],
    config: [{ key: "enabled", label: "Aktif", type: "boolean", default: "false" }],
  },
  {
    key: "maps",
    name: "Maps",
    description: "Peta jaringan FTTH / coverage.",
    secrets: [{ key: "token", label: "Maps Token / API Key", env: "MAPS_TOKEN" }],
    config: [
      { key: "default_zoom", label: "Default Zoom", type: "text", default: "13" },
      { key: "enabled", label: "Aktif", type: "boolean", default: "false" },
    ],
  },
  {
    key: "genieacs",
    name: "GenieACS",
    description: "Manajemen perangkat TR-069.",
    secrets: [{ key: "password", label: "Password", env: "GENIEACS_PASSWORD" }],
    config: [
      { key: "url", label: "Server URL", type: "text" },
      { key: "username", label: "Username", type: "text" },
      { key: "enabled", label: "Aktif", type: "boolean", default: "false" },
    ],
  },
];

/** Prefix key settings DB untuk config non-secret: intg_<ikey>_<field>. */
export function configKey(ikey: string, field: string): string {
  return `intg_${ikey}_${field}`;
}

export function findIntegration(key: string): Integration | undefined {
  return INTEGRATIONS.find((i) => i.key === key);
}
