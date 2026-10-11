// Server-side NBI client. Credentials never travel to the browser.
export class GenieError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
type Tree = Record<string, any>;
export type WifiNetwork = { path: string; ssid: string; writable: boolean; passwordPath: string | null };
export type GenieDevice = {
  id: string; serial: string; manufacturer: string; model: string; software: string;
  lastInform: string | null; recent: boolean; tags: string[]; wifi: WifiNetwork[];
};
const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";
const value = (root: Tree, path: string) => path.split(".").reduce((node, key) => node?.[key], root)?._value;
const leaf = (root: Tree, path: string) => path.split(".").reduce((node, key) => node?.[key], root);

export function normalizeDevice(raw: Tree): GenieDevice {
  const wifi: WifiNetwork[] = [];
  const walk = (node: Tree, prefix = "") => {
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("_") || !child || typeof child !== "object") continue;
      const path = prefix ? `${prefix}.${key}` : key;
      if (key === "SSID" && /^InternetGatewayDevice\.LANDevice\.\d+\.WLANConfiguration\.\d+\.SSID$/.test(path)) {
        const base = path.slice(0, -5);
        const candidates = [`${base}.KeyPassphrase`, `${base}.PreSharedKey.1.KeyPassphrase`, `${base}.PreSharedKey.1.PreSharedKey`];
        wifi.push({ path, ssid: text(child._value), writable: child._writable === true,
          passwordPath: candidates.find(p => leaf(raw, p)?._writable === true) ?? null });
      } else if (key === "SSID" && /^Device\.WiFi\.SSID\.\d+\.SSID$/.test(path)) {
        const reference = path.slice(0, -4); // Device.WiFi.SSID.N.
        const aps = raw.Device?.WiFi?.AccessPoint ?? {};
        const ap = Object.entries(aps).find(([k, v]) => /^\d+$/.test(k) &&
          text((v as Tree)?.SSIDReference?._value).replace(/\.$/, "") === reference.replace(/\.$/, ""));
        const passwordPath = ap ? `Device.WiFi.AccessPoint.${ap[0]}.Security.KeyPassphrase` : null;
        wifi.push({ path, ssid: text(child._value), writable: child._writable === true,
          passwordPath: passwordPath && leaf(raw, passwordPath)?._writable === true ? passwordPath : null });
      }
      if (!("_value" in child)) walk(child, path);
    }
  };
  walk(raw);
  const lastInform = raw._lastInform ? text(raw._lastInform) : null;
  const age = lastInform ? Date.now() - Date.parse(lastInform) : Infinity;
  return {
    id: text(raw._id), serial: text(raw._deviceId?._SerialNumber),
    manufacturer: text(raw._deviceId?._Manufacturer) || text(value(raw, "Device.DeviceInfo.Manufacturer")) || text(value(raw, "InternetGatewayDevice.DeviceInfo.Manufacturer")),
    model: text(value(raw, "Device.DeviceInfo.ModelName")) || text(value(raw, "InternetGatewayDevice.DeviceInfo.ModelName")) || text(raw._deviceId?._ProductClass),
    software: text(value(raw, "Device.DeviceInfo.SoftwareVersion")) || text(value(raw, "InternetGatewayDevice.DeviceInfo.SoftwareVersion")),
    lastInform, recent: age >= 0 && age <= 15 * 60 * 1000,
    tags: Array.isArray(raw._tags) ? raw._tags.filter((x: unknown) => typeof x === "string") : [], wifi,
  };
}

export function genieConfig() {
  const address = process.env.GENIEACS_NBI_URL?.trim();
  if (!address) throw new GenieError("GenieACS belum dikonfigurasi. Isi GENIEACS_NBI_URL pada server.", 503);
  let url: URL;
  try { url = new URL(address); } catch { throw new GenieError("URL GenieACS tidak valid", 503); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new GenieError("Gunakan URL HTTP(S) tanpa kredensial/query", 503);
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = process.env.GENIEACS_NBI_TOKEN;
  const username = process.env.GENIEACS_NBI_USERNAME;
  const password = process.env.GENIEACS_NBI_PASSWORD;
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (username && password) headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  else if (username || password) throw new GenieError("Username dan password GenieACS harus diisi berpasangan", 503);
  return { base: url.toString().replace(/\/$/, ""), headers };
}

export async function genieRequest(path: string, init: RequestInit = {}) {
  const config = genieConfig();
  let response: Response;
  try {
    response = await fetch(`${config.base}/${path}`, {
      ...init, headers: { ...config.headers, ...(init.body ? { "Content-Type": "application/json" } : {}) },
      signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error",
    });
  } catch {
    throw new GenieError("GenieACS tidak dapat dijangkau atau timeout. Untuk aksi perangkat, periksa antrean sebelum mengulang.");
  }
  if (!response.ok) throw new GenieError(`GenieACS menolak permintaan (HTTP ${response.status})`);
  const body = await response.text();
  if (body.length > 4_000_000) throw new GenieError("Respons GenieACS terlalu besar. Persempit pencarian.");
  let data: any;
  try { data = body ? JSON.parse(body) : null; } catch { throw new GenieError("Respons GenieACS bukan JSON"); }
  return { data, status: response.status, total: response.headers.get("total") };
}

const PROJECTION = "_id,_deviceId,_lastInform,_tags,Device.DeviceInfo,InternetGatewayDevice.DeviceInfo";
export async function listDevices(search: string, page: number, limit: number) {
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const query = search ? { $or: ["_id", "_deviceId._SerialNumber", "_deviceId._Manufacturer"].map(key => ({ [key]: { $regex: escaped, $options: "i" } })) } : {};
  const params = new URLSearchParams({ query: JSON.stringify(query), projection: PROJECTION, sort: JSON.stringify({ _id: 1 }), skip: String((page - 1) * limit), limit: String(limit) });
  const r = await genieRequest(`devices/?${params}`);
  if (!Array.isArray(r.data)) throw new GenieError("Daftar perangkat GenieACS tidak valid");
  const count = r.total === null ? NaN : Number(r.total);
  return { items: r.data.map(normalizeDevice), total: Number.isFinite(count) ? count : null, page, limit };
}

export async function getDevice(id: string): Promise<Tree> {
  const r = await genieRequest(`devices/?${new URLSearchParams({ query: JSON.stringify({ _id: id }), limit: "1" })}`);
  if (!Array.isArray(r.data) || !r.data.length) throw new GenieError("Perangkat tidak ditemukan", 404);
  return r.data[0];
}

export function wifiTask(raw: Tree, input: { path: string; ssid: string; password?: string }) {
  const network = normalizeDevice(raw).wifi.find(w => w.path === input.path);
  if (!network?.writable) throw new GenieError("SSID tidak tersedia atau tidak dapat diubah", 400);
  if (!input.ssid.trim() || Buffer.byteLength(input.ssid, "utf8") > 32) throw new GenieError("SSID harus 1–32 byte", 400);
  const parameterValues: [string, string, string][] = [[network.path, input.ssid, "xsd:string"]];
  if (input.password) {
    if (!network.passwordPath) throw new GenieError("Parameter password tidak didukung perangkat", 400);
    if (!/^[\x20-\x7e]{8,63}$/.test(input.password)) throw new GenieError("Password Wi-Fi harus 8–63 karakter ASCII", 400);
    parameterValues.push([network.passwordPath, input.password, "xsd:string"]);
  }
  return { name: "setParameterValues", parameterValues };
}

export async function enqueueTask(id: string, task: Record<string, unknown>) {
  const result = await genieRequest(`devices/${encodeURIComponent(id)}/tasks?connection_request&timeout=5000`, { method: "POST", body: JSON.stringify(task) });
  return { taskId: text(result.data?._id), status: result.status === 202 ? "queued" : "executed" };
}
