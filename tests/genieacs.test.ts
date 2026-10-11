import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { normalizeDevice, wifiTask, listDevices, enqueueTask, genieRequest } from "../src/lib/genieacs";
const leaf = (value: string, writable = true) => ({ _value: value, _writable: writable });
const tr098 = { _id: "ABC-model-SN%2D1", _deviceId: { _SerialNumber: "SN1", _Manufacturer: "Test" },
  InternetGatewayDevice: { LANDevice: { "2": { WLANConfiguration: { "3": { SSID: leaf("Home"), KeyPassphrase: leaf("sensitive-secret") } } } } } };
const tr181 = { _id: "DEF-model-SN2", Device: { WiFi: { SSID: { "4": { SSID: leaf("Home 5G") } },
  AccessPoint: { "8": { SSIDReference: leaf("Device.WiFi.SSID.4."), Security: { KeyPassphrase: leaf("another-secret") } } } } } };

test("TR-098 and TR-181 Wi-Fi resolve actual instances without exposing passwords", () => {
  const a = normalizeDevice(tr098); const b = normalizeDevice(tr181);
  assert.equal(a.wifi[0].path, "InternetGatewayDevice.LANDevice.2.WLANConfiguration.3.SSID");
  assert.equal(b.wifi[0].passwordPath, "Device.WiFi.AccessPoint.8.Security.KeyPassphrase");
  assert.ok(!JSON.stringify(a).includes("sensitive-secret"));
  assert.ok(!JSON.stringify(b).includes("another-secret"));
  assert.equal(a.recent, false);
  const task = wifiTask(tr181, { path: b.wifi[0].path, ssid: "New", password: "newpass123" });
  assert.equal(task.parameterValues.length, 2);
  assert.throws(() => wifiTask(tr181, { path: "Device.ManagementServer.URL", ssid: "New" }));
  assert.throws(() => wifiTask(tr181, { path: b.wifi[0].path, ssid: "😀".repeat(9) }));
  assert.throws(() => wifiTask(tr181, { path: b.wifi[0].path, ssid: "New", password: "short" }));
  assert.equal(wifiTask(tr181, { path: b.wifi[0].path, ssid: "New" }).parameterValues.length, 1);
});

test("NBI client encodes IDs, literal search, auth, and preserves queued task status", async () => {
  const requests: { url: string; auth?: string; body: string }[] = [];
  const server = createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    requests.push({ url: req.url!, auth: req.headers.authorization, body });
    if (req.url === "/error") { res.writeHead(401); res.end("secret server detail"); return; }
    if (req.url === "/redirect") { res.writeHead(302, { Location: "/devices/" }); res.end(); return; }
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST") { res.writeHead(202); res.end(JSON.stringify({ _id: "task1", ...JSON.parse(body) })); }
    else { res.setHeader("total", "1"); res.end(JSON.stringify([tr098])); }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  process.env.GENIEACS_NBI_URL = `http://127.0.0.1:${address.port}`;
  process.env.GENIEACS_NBI_TOKEN = "test-only-token";
  try {
    const result = await listDevices("SN.*", 2, 20);
    assert.equal(result.total, 1);
    const q = new URL(requests[0].url, "http://local").searchParams;
    assert.equal(q.get("skip"), "20");
    assert.equal(JSON.parse(q.get("query")!).$or[0]._id.$regex, "SN\\.\\*");
    const task = await enqueueTask(tr098._id, { name: "reboot" });
    assert.equal(task.status, "queued"); assert.equal(task.taskId, "task1");
    assert.ok(requests[1].url.includes("SN%252D1/tasks"));
    assert.equal(requests[1].auth, "Bearer test-only-token");
    await assert.rejects(genieRequest("error"), error => String(error).includes("HTTP 401") && !String(error).includes("secret server detail"));
    await assert.rejects(genieRequest("redirect"));
  } finally {
    delete process.env.GENIEACS_NBI_URL; delete process.env.GENIEACS_NBI_TOKEN;
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
