"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CheckRow = { key: string; label: string; present: boolean };
type CheckData = {
  nodeVersion: string;
  nodeOk: boolean;
  required: CheckRow[];
  optional: CheckRow[];
  dbOk: boolean;
  dbLatencyMs: number | null;
  dbError: string | null;
  pgVersion: string | null;
  allOk: boolean;
};
type StatusData = {
  node: string; nodeOk: boolean; env: Record<string, boolean>; envOk: boolean;
  dbReachable: boolean; tablesOk: boolean; adminExists: boolean; companySet: boolean; completed: boolean;
};
type MigrateFile = { file: string; status: "ok" | "skipped" | "error"; detail?: string };

const STEPS = ["Cek Sistem", "Database", "Admin", "Perusahaan", "Selesai"];

const TIMEZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Singapore", "UTC"];

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        {...props}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </label>
  );
}

export default function InstallPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [check, setCheck] = useState<CheckData | null>(null);
  const [checking, setChecking] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateRes, setMigrateRes] = useState<MigrateFile[] | null>(null);
  const [migrateFailed, setMigrateFailed] = useState(false);
  const [adminExists, setAdminExists] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminDone, setAdminDone] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: "", address: "", phone: "", email: "", timezone: "Asia/Jakarta" });
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyDone, setCompanyDone] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refreshStatus = async () => {
    try {
      const r = await fetch("/api/install/status", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setStatus(j.data);
    } catch { /* abaikan */ }
  };

  // Guard: admin sudah ada → ke login
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/install/status", { cache: "no-store" });
        const j = await r.json();
        if (j.ok) {
          setStatus(j.data);
          if (j.data.adminExists) {
            router.replace("/login");
            return;
          }
          if (j.data.completed) {
            router.replace("/login");
            return;
          }
        }
      } catch { /* lanjut tampilkan wizard, API akan memberi pesan */ }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runCheck = async () => {
    setChecking(true);
    setErr(null);
    try {
      const r = await fetch("/api/install/check", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setCheck(j.data);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { runCheck(); }, []);

  const runMigrate = async () => {
    setMigrating(true);
    setErr(null);
    try {
      const r = await fetch("/api/install/migrate", { method: "POST" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setMigrateRes(j.data.files);
      setMigrateFailed(j.data.failed);
      await refreshStatus();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    if (step !== 2) return;
    (async () => {
      try {
        const r = await fetch("/api/install/admin", { cache: "no-store" });
        const j = await r.json();
        if (j.ok) {
          setAdminExists(j.data.exists);
        }
      } catch { /* abaikan */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const submitAdmin = async () => {
    setErr(null);
    if (adminForm.password !== adminForm.confirm) {
      setErr("Konfirmasi password tidak sama");
      return;
    }
    setSavingAdmin(true);
    try {
      const r = await fetch("/api/install/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: adminForm.name, email: adminForm.email, password: adminForm.password }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setAdminDone(true);
      await refreshStatus();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSavingAdmin(false);
    }
  };

  useEffect(() => {
    if (step !== 3) return;
    (async () => {
      try {
        const r = await fetch("/api/install/company", { cache: "no-store" });
        const j = await r.json();
        if (j.ok && j.data.company) {
          setCompanyForm({
            name: j.data.company.name ?? "",
            address: j.data.company.address ?? "",
            phone: j.data.company.phone ?? "",
            email: j.data.company.email ?? "",
            timezone: j.data.timezone ?? "Asia/Jakarta",
          });
        }
      } catch { /* abaikan */ }
    })();
  }, [step]);

  const submitCompany = async () => {
    setErr(null);
    setSavingCompany(true);
    try {
      const r = await fetch("/api/install/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyForm),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setCompanyDone(true);
      await refreshStatus();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSavingCompany(false);
    }
  };

  const finish = async () => {
    setFinishing(true);
    setErr(null);
    try {
      const r = await fetch("/api/install/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finish: true }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      router.push("/login");
    } catch (e) {
      setErr((e as Error).message);
      setFinishing(false);
    }
  };

  const CheckRow = ({ okk, label, detail }: { okk: boolean; label: string; detail?: string }) => (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2">
      <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${okk ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
        {okk ? "✓" : "✕"}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {detail && <p className="text-xs text-slate-500 break-all">{detail}</p>}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Memeriksa status instalasi…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500 flex flex-col">
      <header className="max-w-3xl w-full mx-auto px-4 h-16 flex items-center">
        <span className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/25 text-white font-extrabold flex items-center justify-center text-lg">G</span>
        <span className="ml-2.5 font-extrabold tracking-tight text-lg text-white">GenISP — Wizard Instalasi</span>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-6">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          {/* Stepper */}
          <ol className="flex items-center mb-8">
            {STEPS.map((s, i) => (
              <li key={s} className="flex-1 flex items-center last:flex-none">
                <div className="flex items-center gap-2">
                  <span className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${i < step ? "bg-emerald-500 text-white" : i === step ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                    {i < step ? "✓" : i + 1}
                  </span>
                  <span className={`text-xs sm:text-sm font-medium ${i === step ? "text-slate-900" : "text-slate-400"} hidden sm:block`}>{s}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? "bg-emerald-500" : "bg-slate-200"}`} />}
              </li>
            ))}
          </ol>

          {err && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{err}</div>
          )}

          {/* STEP 1 */}
          {step === 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Cek kebutuhan sistem</h2>
              <p className="text-sm text-slate-500 mb-5">Pastikan server memenuhi syarat sebelum lanjut. Tanpa license key — wizard ini gratis & terbuka.</p>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <CheckRow okk={check?.nodeOk ?? false} label={`Node.js ${check?.nodeVersion ?? "…"}`} detail="Minimal v18" />
                <CheckRow okk={check?.dbOk ?? false} label="Koneksi database" detail={check?.dbError ?? (check?.pgVersion ? `${check.pgVersion} · ${check.dbLatencyMs} ms` : undefined)} />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Environment wajib</h3>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                {(check?.required ?? []).map((r) => (
                  <CheckRow key={r.key} okk={r.present} label={r.key} detail={r.label} />
                ))}
              </div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Opsional (bisa diisi nanti)</h3>
              <div className="grid sm:grid-cols-2 gap-3 mb-6">
                {(check?.optional ?? []).map((r) => (
                  <CheckRow key={r.key} okk={r.present} label={r.key} detail={r.label} />
                ))}
              </div>
              <div className="flex justify-between">
                <button onClick={runCheck} disabled={checking} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  {checking ? "Mengecek…" : "Cek ulang"}
                </button>
                <button onClick={() => setStep(1)} disabled={!check?.allOk} className="px-6 py-2 text-sm font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40">
                  Lanjut →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Konfigurasi database</h2>
              <p className="text-sm text-slate-500 mb-5">Jalankan migrasi skema <code className="bg-slate-100 px-1 rounded">supabase/migrations/*.sql</code> secara berurutan. Objek yang sudah ada dilewati dengan aman.</p>
              <div className="mb-4">
                <CheckRow okk={status?.dbReachable ?? false} label="Koneksi database" detail={status?.dbReachable ? "Terhubung" : "Tidak terhubung — cek DATABASE_URL"} />
              </div>
              {migrateRes && (
                <div className="mb-4 space-y-2">
                  {migrateRes.map((f) => (
                    <div key={f.file} className={`rounded-lg border px-3 py-2 text-sm ${f.status === "error" ? "border-red-200 bg-red-50" : "border-slate-200"}`}>
                      <span className={`font-mono font-medium ${f.status === "ok" ? "text-emerald-700" : f.status === "skipped" ? "text-amber-700" : "text-red-700"}`}>
                        {f.status === "ok" ? "✓" : f.status === "skipped" ? "⊘" : "✕"} {f.file}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">{f.status === "skipped" ? "sudah ada, dilewati" : ""}</span>
                      {f.detail && f.status === "error" && <p className="text-xs text-red-600 break-all mt-1">{f.detail}</p>}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between">
                <button onClick={() => setStep(0)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">← Kembali</button>
                <div className="flex gap-2">
                  <button onClick={runMigrate} disabled={migrating || !status?.dbReachable} className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40">
                    {migrating ? "Menjalankan…" : "Jalankan migrasi"}
                  </button>
                  <button onClick={() => setStep(2)} disabled={!migrateRes || migrateFailed} className="px-6 py-2 text-sm font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40">
                    Lanjut →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Buat admin pertama</h2>
              <p className="text-sm text-slate-500 mb-5">Akun ini menjadi superadmin. Hanya bisa dibuat bila belum ada admin.</p>
              {adminExists ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-4">
                  Admin sudah ada (mungkin dari seed bawaan <code className="bg-amber-100 px-1 rounded">admin@genisp.id</code>). Lewati langkah ini, lalu ganti password default setelah login pertama.
                </div>
              ) : adminDone ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 mb-4">✓ Admin berhasil dibuat.</div>
              ) : (
                <div className="space-y-4 mb-6">
                  <Field label="Nama lengkap" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} placeholder="Administrator" />
                  <Field label="Email" type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} placeholder="admin@contoh.id" />
                  <Field label="Password (min 8, huruf besar+ kecil + angka)" type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
                  <Field label="Konfirmasi password" type="password" value={adminForm.confirm} onChange={(e) => setAdminForm({ ...adminForm, confirm: e.target.value })} />
                </div>
              )}
              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">← Kembali</button>
                <div className="flex gap-2">
                  {!adminDone && !adminExists && (
                    <button onClick={submitAdmin} disabled={savingAdmin} className="px-6 py-2 text-sm font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40">
                      {savingAdmin ? "Menyimpan…" : "Buat admin"}
                    </button>
                  )}
                  <button onClick={() => setStep(3)} disabled={!adminDone && !adminExists} className="px-6 py-2 text-sm font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-40">
                    Lanjut →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Profil perusahaan</h2>
              <p className="text-sm text-slate-500 mb-5">Data ini tampil di invoice, portal pelanggan, dan halaman publik.</p>
              <div className="space-y-4 mb-6">
                <Field label="Nama perusahaan *" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} placeholder="PT Contoh Internet" />
                <Field label="Alamat" value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} placeholder="Jl. Contoh No. 1" />
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Telepon / WhatsApp" value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} placeholder="0812…" />
                  <Field label="Email perusahaan" type="email" value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} placeholder="cs@contoh.id" />
                </div>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Zona waktu</span>
                  <select
                    value={companyForm.timezone}
                    onChange={(e) => setCompanyForm({ ...companyForm, timezone: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </label>
              </div>
              {companyDone && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 mb-4">✓ Profil perusahaan tersimpan.</div>}
              <div className="flex justify-between">
                <button onClick={() => setStep(2)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">← Kembali</button>
                <div className="flex gap-2">
                  <button onClick={submitCompany} disabled={savingCompany} className="px-6 py-2 text-sm font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40">
                    {savingCompany ? "Menyimpan…" : "Simpan"}
                  </button>
                  <button onClick={() => setStep(4)} disabled={!companyDone} className="px-6 py-2 text-sm font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-40">
                    Lanjut →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Verifikasi akhir</h2>
              <p className="text-sm text-slate-500 mb-5">Pastikan semua komponen instalasi tercentang sebelum selesai.</p>
              <div className="space-y-3 mb-6">
                <CheckRow okk={status?.nodeOk ?? false} label="Lingkungan runtime" detail={`Node ${status?.node ?? "?"}`} />
                <CheckRow okk={status?.envOk ?? false} label="Environment wajib" detail="DATABASE_URL, JWT_SECRET" />
                <CheckRow okk={status?.dbReachable ?? false} label="Koneksi database" />
                <CheckRow okk={status?.tablesOk ?? false} label="Skema database (migrasi)" detail={status?.tablesOk ? "Tabel users, company, settings, roles tersedia" : "Jalankan migrasi di langkah 2"} />
                <CheckRow okk={status?.adminExists ?? false} label="Akun admin" detail={status?.adminExists ? "Sudah ada" : "Belum dibuat (langkah 3)"} />
                <CheckRow okk={status?.companySet ?? false} label="Profil perusahaan" detail={status?.companySet ? "Sudah diisi" : "Belum diisi (langkah 4)"} />
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep(3)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">← Kembali</button>
                <button
                  onClick={finish}
                  disabled={finishing || !(status?.tablesOk && status?.adminExists && status?.companySet)}
                  className="px-8 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  {finishing ? "Menyelesaikan…" : "Selesai → Login"}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-4">Tidak ada license key, serial, atau aktivasi — GenISP bebas dipakai.</p>
            </div>
          )}
        </div>
      </main>

      <p className="text-center text-xs text-white/60 pb-6">GenISP · Wizard instalasi</p>
    </div>
  );
}
