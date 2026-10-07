// Integrasi payment gateway: Xendit, Midtrans, Tripay (fetch-based).
// Kredensial dibaca dari process.env DULU, fallback ke tabel settings.
// Semua fungsi create* melempar Error("Gateway belum dikonfigurasi") bila key kosong.
import { createHash, createHmac } from "node:crypto";
import { sql } from "./db";

async function getSecret(envName: string, settingKey: string): Promise<string> {
  if (process.env[envName]) return process.env[envName] as string;
  try {
    const db = sql();
    const rows = await db`select value from settings where key = ${settingKey}`;
    return (rows[0]?.value as string) ?? "";
  } catch {
    return "";
  }
}

// ================= XENDIT =================
export async function createXenditInvoice(opts: {
  externalId: string;
  amount: number;
  description?: string;
  payerEmail?: string;
}) {
  const key = await getSecret("XENDIT_SECRET_KEY", "xendit_secret_key");
  if (!key) throw new Error("Gateway belum dikonfigurasi");
  const res = await fetch("https://api.xendit.co/v2/invoices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(key + ":").toString("base64"),
    },
    body: JSON.stringify({
      external_id: opts.externalId,
      amount: Math.round(opts.amount),
      description: opts.description ?? "Pembayaran tagihan internet",
      payer_email: opts.payerEmail,
    }),
  });
  if (!res.ok) throw new Error(`Xendit error HTTP ${res.status}`);
  return (await res.json()) as { id: string; invoice_url: string; expiry_date: string };
}

export async function verifyXenditCallback(req: Request) {
  const token = await getSecret("XENDIT_CALLBACK_TOKEN", "xendit_callback_token");
  const header = req.headers.get("x-callback-token");
  if (!token || header !== token) throw new Error("Token callback Xendit tidak valid");
  const raw = (await req.json()) as Record<string, unknown>;
  const status = String(raw.status ?? "").toUpperCase();
  return {
    paid: status === "PAID" || status === "SETTLED",
    externalId: String(raw.external_id ?? ""),
    amount: Number(raw.amount ?? raw.paid_amount ?? 0),
    raw,
  };
}

// ================= MIDTRANS =================
export async function createMidtransTransaction(opts: {
  orderId: string;
  amount: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}) {
  const serverKey = await getSecret("MIDTRANS_SERVER_KEY", "midtrans_server_key");
  if (!serverKey) throw new Error("Gateway belum dikonfigurasi");
  const isProd =
    (process.env.MIDTRANS_IS_PRODUCTION ?? (await getSecret("MIDTRANS_IS_PRODUCTION", "midtrans_is_production"))) ===
    "true";
  const base = isProd ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
  const res = await fetch(`${base}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Basic " + Buffer.from(serverKey + ":").toString("base64"),
    },
    body: JSON.stringify({
      transaction_details: { order_id: opts.orderId, gross_amount: Math.round(opts.amount) },
      customer_details: {
        first_name: opts.customerName ?? "Pelanggan",
        email: opts.customerEmail,
        phone: opts.customerPhone,
      },
    }),
  });
  if (!res.ok) throw new Error(`Midtrans error HTTP ${res.status}`);
  return (await res.json()) as { token: string; redirect_url: string };
}

export async function verifyMidtransSignature(opts: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}) {
  const serverKey = await getSecret("MIDTRANS_SERVER_KEY", "midtrans_server_key");
  if (!serverKey) throw new Error("Gateway belum dikonfigurasi");
  const expected = createHash("sha512")
    .update(opts.orderId + opts.statusCode + opts.grossAmount + serverKey)
    .digest("hex");
  if (expected !== opts.signatureKey) throw new Error("Signature Midtrans tidak valid");
  return true;
}

// ================= TRIPAY =================
export async function createTripayTransaction(opts: {
  merchantRef: string;
  amount: number;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  method?: string;
}) {
  const apiKey = await getSecret("TRIPAY_API_KEY", "tripay_api_key");
  const privateKey = await getSecret("TRIPAY_PRIVATE_KEY", "tripay_private_key");
  const merchantCode = await getSecret("TRIPAY_MERCHANT_CODE", "tripay_merchant_code");
  if (!apiKey || !privateKey || !merchantCode) throw new Error("Gateway belum dikonfigurasi");
  const signature = createHmac("sha256", privateKey)
    .update(merchantCode + opts.merchantRef + Math.round(opts.amount))
    .digest("hex");
  const res = await fetch("https://tripay.co.id/api/transaction/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify({
      method: opts.method ?? "QRIS",
      merchant_ref: opts.merchantRef,
      amount: Math.round(opts.amount),
      customer_name: opts.customerName,
      customer_email: opts.customerEmail ?? "",
      customer_phone: opts.customerPhone ?? "",
      order_items: [
        { sku: "TAGIHAN", name: "Tagihan internet", price: Math.round(opts.amount), quantity: 1 },
      ],
      signature,
    }),
  });
  const json = (await res.json()) as { success: boolean; message: string; data: unknown };
  if (!res.ok || !json.success) throw new Error(`Tripay error: ${json.message ?? res.status}`);
  return json.data;
}

export async function verifyTripayCallback(req: Request) {
  const privateKey = await getSecret("TRIPAY_PRIVATE_KEY", "tripay_private_key");
  if (!privateKey) throw new Error("Gateway belum dikonfigurasi");
  const rawText = await req.text();
  const signature = req.headers.get("x-callback-signature") ?? "";
  const expected = createHmac("sha256", privateKey).update(rawText).digest("hex");
  if (!signature || signature !== expected) throw new Error("Signature Tripay tidak valid");
  const raw = JSON.parse(rawText) as Record<string, unknown>;
  return {
    paid: String(raw.status ?? "").toUpperCase() === "PAID",
    merchantRef: String(raw.merchant_ref ?? ""),
    amount: Number(raw.total_amount ?? raw.amount ?? 0),
    raw,
  };
}

// ================= DUITKU =================
// Docs: https://docs.duitku.com — signature MD5(merchantCode + merchantOrderId + amount + apiKey)
export async function createDuitkuInvoice(opts: {
  merchantOrderId: string;
  amount: number;
  productDetails: string;
  customerVaName: string;
  customerEmail?: string;
  customerPhone?: string;
  callbackUrl?: string;
  returnUrl?: string;
}) {
  const merchantCode = await getSecret("DUITKU_MERCHANT_CODE", "duitku_merchant_code");
  const apiKey = await getSecret("DUITKU_API_KEY", "duitku_api_key");
  if (!merchantCode || !apiKey) throw new Error("Gateway belum dikonfigurasi");
  const amount = Math.round(opts.amount);
  const signature = createHash("md5")
    .update(merchantCode + opts.merchantOrderId + amount + apiKey)
    .digest("hex");
  const isProd = (await getSecret("DUITKU_IS_PRODUCTION", "duitku_is_production")) === "true";
  const base = isProd ? "https://passport.duitku.com/webapi" : "https://sandbox.duitku.com/webapi";
  const res = await fetch(`${base}/api/merchant/v2/inquiry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchantCode,
      paymentAmount: amount,
      merchantOrderId: opts.merchantOrderId,
      productDetails: opts.productDetails,
      additionalParam: "",
      merchantUserInfo: "",
      customerVaName: opts.customerVaName,
      email: opts.customerEmail ?? "",
      phoneNumber: opts.customerPhone ?? "",
      itemDetails: [{ name: opts.productDetails, price: amount, quantity: 1 }],
      customerDetail: {
        firstName: opts.customerVaName,
        email: opts.customerEmail ?? "",
        phoneNumber: opts.customerPhone ?? "",
      },
      callbackUrl: opts.callbackUrl ?? "",
      returnUrl: opts.returnUrl ?? "",
      signature,
      expiryPeriod: 60,
    }),
  });
  const json = (await res.json()) as {
    statusCode: string;
    statusMessage: string;
    reference?: string;
    paymentUrl?: string;
    vaNumber?: string;
    qrString?: string;
  };
  if (!res.ok || json.statusCode !== "00")
    throw new Error(`Duitku error: ${json.statusMessage ?? `HTTP ${res.status}`}`);
  return json;
}

export async function verifyDuitkuCallback(body: Record<string, unknown>) {
  const apiKey = await getSecret("DUITKU_API_KEY", "duitku_api_key");
  if (!apiKey) throw new Error("Gateway belum dikonfigurasi");
  const merchantOrderId = String(body.merchantOrderId ?? "");
  const amount = String(body.amount ?? "");
  const signature = String(body.signature ?? "");
  const expected = createHash("md5").update(amount + merchantOrderId + apiKey).digest("hex");
  if (!signature || signature !== expected) throw new Error("Signature Duitku tidak valid");
  return {
    paid: String(body.resultCode ?? "") === "00",
    merchantOrderId,
    amount: Number(amount || 0),
    reference: String(body.reference ?? ""),
    raw: body,
  };
}

// ================= DOKU (Jokul O2O: Alfa/Indomaret) =================
// Verifikasi HMAC-SHA256 dari raw body terhadap header signature.
export async function verifyDokuCallback(req: Request) {
  const secret = await getSecret("DOKU_SECRET", "doku_secret");
  if (!secret) throw new Error("Gateway belum dikonfigurasi");
  const rawText = await req.text();
  const signature =
    req.headers.get("signature") ?? req.headers.get("x-doku-signature") ?? "";
  const expected = createHmac("sha256", secret).update(rawText).digest("hex");
  if (!signature || signature !== expected) throw new Error("Signature Doku tidak valid");
  const raw = JSON.parse(rawText) as Record<string, unknown>;
  const order = (raw.order as Record<string, unknown> | undefined) ?? {};
  const status = String(
    raw.transaction_status ?? raw.transaction?.toString?.() ?? ""
  ).toUpperCase();
  return {
    paid: ["SUCCESS", "SETTLEMENT", "PAID"].includes(status),
    invoiceNumber: String(order.invoice_number ?? raw.invoice_number ?? ""),
    amount: Number(order.amount ?? raw.amount ?? 0),
    raw,
  };
}

/** Response standar Doku untuk notification (Jokul). */
export function dokuResponseOk(extra?: Record<string, unknown>) {
  return {
    responseCode: "2000000",
    responseMessage: "Successful",
    ...extra,
  };
}

// ================= IPAYMU =================
// create: signature = HMAC-SHA256(va + apiKey); body membawa key = sha256(json_body)
export async function createIpaymuPayment(opts: {
  amount: number;
  buyerName: string;
  buyerPhone?: string;
  buyerEmail?: string;
  referenceId: string;
  returnUrl?: string;
  notifyUrl?: string;
}) {
  const va = await getSecret("IPAYMU_VA", "ipaymu_va");
  const apiKey = await getSecret("IPAYMU_API_KEY", "ipaymu_api_key");
  if (!va || !apiKey) throw new Error("Gateway belum dikonfigurasi");
  const body = {
    product: ["Tagihan internet"],
    qty: [1],
    price: [Math.round(opts.amount)],
    returnUrl: opts.returnUrl ?? "",
    notifyUrl: opts.notifyUrl ?? "",
    referenceId: opts.referenceId,
    buyerName: opts.buyerName,
    buyerPhone: opts.buyerPhone ?? "",
    buyerEmail: opts.buyerEmail ?? "",
    expired: 24,
    expiredType: "hours",
  };
  const bodyJson = JSON.stringify(body);
  const key = createHash("sha256").update(bodyJson).digest("hex");
  const signature = createHmac("sha256", apiKey).update(va + apiKey).digest("hex");
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const res = await fetch("https://my.ipaymu.com/api/v2/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json", va, signature, timestamp },
    body: JSON.stringify({ ...body, key }),
  });
  const json = (await res.json()) as {
    Status: number;
    Message: string;
    Data: unknown;
  };
  if (!res.ok || json.Status !== 200)
    throw new Error(`iPaymu error: ${json.Message ?? `HTTP ${res.status}`}`);
  return json.Data as { SessionId?: string; Url?: string; QrString?: string };
}

export async function verifyIpaymuCallback(body: Record<string, unknown>) {
  const apiKey = await getSecret("IPAYMU_API_KEY", "ipaymu_api_key");
  if (!apiKey) throw new Error("Gateway belum dikonfigurasi");
  const referenceId = String(body.referenceId ?? body.reference_id ?? "");
  const status = String(body.status ?? "").toLowerCase();
  const signature = String(body.signature ?? "");
  if (signature) {
    const expected = createHmac("sha256", apiKey).update(referenceId + apiKey).digest("hex");
    if (signature !== expected) throw new Error("Signature iPaymu tidak valid");
  }
  return {
    paid: ["berhasil", "success", "paid", "settlement"].includes(status),
    referenceId,
    trxId: String(body.trxId ?? body.trx_id ?? ""),
    amount: Number(body.total ?? body.amount ?? 0),
    raw: body,
  };
}

// ================= BNI VA (direct, sederhana) =================
// Nomor VA = prefix (default "988") + digit acak hingga 16 digit.
// Disimpan ke tabel va_transaction; callback diverifikasi via token rahasia.
export async function createBniVA(opts: {
  customerName: string;
  amount: number;
  expiredHours?: number;
  trxId: string;
  invoiceId?: number;
}) {
  const db = sql();
  const prefix = ((await getSecret("BNI_VA_PREFIX", "bni_va_prefix")) || "988").replace(
    /\D/g,
    ""
  );
  const digits = "0123456789";
  let rand = "";
  const buf = new Uint32Array(16);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 16; i++) rand += digits[buf[i] % 10];
  const vaNumber = (prefix + rand).slice(0, 16);
  const expiredAt = new Date(Date.now() + (opts.expiredHours ?? 24) * 3600 * 1000);
  const rows = await db`insert into va_transaction
    (vendor, va_number, customer_name, trx_id, invoice_id, amount, status, expired_at)
    values ('bni', ${vaNumber}, ${opts.customerName}, ${opts.trxId},
      ${opts.invoiceId ?? null}, ${Math.round(opts.amount)}, 'UNPAID', ${expiredAt.toISOString()})
    returning *`;
  return { vaNumber, expiredAt: expiredAt.toISOString(), row: rows[0] };
}

export async function verifyBniCallback(body: Record<string, unknown>) {
  const token = await getSecret("BNI_CALLBACK_TOKEN", "bni_callback_token");
  if (!token) throw new Error("Gateway belum dikonfigurasi");
  if (String(body.token ?? "") !== token) throw new Error("Token callback BNI tidak valid");
  return {
    paid: true,
    vaNumber: String(body.virtual_account ?? body.va_number ?? ""),
    trxId: String(body.trx_id ?? ""),
    amount: Number(body.amount ?? 0),
    raw: body,
  };
}

// ================= MOOTA (mutasi bank) =================
// Verifikasi HMAC-SHA256(raw body, secret) vs header "signature".
export async function verifyMootaCallback(req: Request) {
  const secret = await getSecret("MOOTA_SECRET", "moota_secret");
  if (!secret) throw new Error("Gateway belum dikonfigurasi");
  const rawText = await req.text();
  const signature = req.headers.get("signature") ?? "";
  const expected = createHmac("sha256", secret).update(rawText).digest("hex");
  if (!signature || signature !== expected) throw new Error("Signature Moota tidak valid");
  const raw = JSON.parse(rawText) as unknown;
  const items = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
  const credit =
    items.find((m) => ["CR", "C", "credit", "kredit"].includes(String(m?.type ?? "").toUpperCase())) ??
    items[0] ??
    {};
  return {
    amount: Number(credit.amount ?? 0),
    description: String(credit.description ?? ""),
    date: String(credit.date ?? credit.created_at ?? ""),
    raw,
  };
}

// ================= INDOSAT =================
// HMAC-SHA256 base64 dari raw body vs header X-WC-WEBHOOK-Signature.
export async function verifyIndosatCallback(req: Request) {
  const secret = await getSecret("INDOSAT_SECRET", "indosat_secret");
  if (!secret) throw new Error("Gateway belum dikonfigurasi");
  const rawText = await req.text();
  const signature = req.headers.get("x-wc-webhook-signature") ?? "";
  const expected = createHmac("sha256", secret).update(rawText).digest("base64");
  if (!signature || signature !== expected)
    throw new Error("Signature Indosat tidak valid");
  const raw = JSON.parse(rawText) as Record<string, unknown>;
  const status = String(raw.status ?? raw.transaction_status ?? "").toLowerCase();
  return {
    paid: ["paid", "success", "settlement", "capture"].includes(status),
    externalId: String(raw.merchant_ref ?? raw.order_id ?? raw.reference ?? ""),
    amount: Number(raw.amount ?? raw.gross_amount ?? 0),
    raw,
  };
}

// ================= TUKEUR =================
// HMAC-SHA256 hex dari raw body vs header X-Signature.
export async function verifyTukeurCallback(req: Request) {
  const secret = await getSecret("TUKEUR_SECRET", "tukeur_secret");
  if (!secret) throw new Error("Gateway belum dikonfigurasi");
  const rawText = await req.text();
  const signature = req.headers.get("x-signature") ?? "";
  const expected = createHmac("sha256", secret).update(rawText).digest("hex");
  if (!signature || signature !== expected) throw new Error("Signature Tukeur tidak valid");
  const raw = JSON.parse(rawText) as Record<string, unknown>;
  const status = String(raw.status ?? "").toUpperCase();
  return {
    paid: ["PAID", "SUCCESS", "SETTLED"].includes(status),
    externalId: String(raw.merchant_ref ?? raw.reference ?? ""),
    amount: Number(raw.amount ?? 0),
    raw,
  };
}
