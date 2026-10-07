import { cookies } from "next/headers";
import { ProfilForm, type Customer } from "@/components/public";

async function getProfile(): Promise<Customer | null> {
  try {
    const res = await fetch("/api/portal/profile", {
      headers: { Cookie: cookies().toString() },
      cache: "no-store",
    });
    const j = await res.json().catch(() => null);
    if (!j || !j.ok || !j.data) return null;
    const d = j.data as Record<string, unknown>;
    if (d.customer) return d.customer as Customer;
    if (typeof d.name === "string") return d as unknown as Customer;
    return null;
  } catch {
    return null;
  }
}

export default async function ProfilPage() {
  const customer = await getProfile();

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Profil Saya</h1>
        <p className="text-sm text-slate-500 mt-1">Perbarui data diri dan kata sandi akun portal Anda.</p>
      </div>

      {customer ? (
        <div className="animate-fade-up" style={{ animationDelay: "80ms" }}>
          <ProfilForm customer={customer} />
        </div>
      ) : (
        <div className="card text-center py-10">
          <p className="text-sm text-slate-400">Gagal memuat data profil. Silakan muat ulang halaman.</p>
        </div>
      )}
    </div>
  );
}
