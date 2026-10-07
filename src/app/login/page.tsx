import Link from "next/link";
import { LoginForm, type Company } from "@/components/public";

async function getCompany(): Promise<Company> {
  try {
    const res = await fetch("/api/public/site", { cache: "no-store" });
    const j = await res.json();
    return { name: "GenISP", ...(j.ok && j.data?.company ? j.data.company : {}) };
  } catch {
    return { name: "GenISP" };
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const company = await getCompany();

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500 flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl animate-float-soft" />
        <div className="absolute bottom-0 -left-24 w-96 h-96 rounded-full bg-brand-300/20 blur-3xl animate-float-slower" />
      </div>

      <header className="relative max-w-6xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/25 text-white font-extrabold flex items-center justify-center text-lg">
            {company.name.charAt(0).toUpperCase()}
          </span>
          <span className="font-extrabold tracking-tight text-lg text-white">{company.name}</span>
        </Link>
        <Link href="/" className="text-sm font-medium text-white/70 hover:text-white transition">
          ← Beranda
        </Link>
      </header>

      <main className="relative flex-1 flex items-center justify-center px-4 py-10">
        <LoginForm next={searchParams.next} />
      </main>

      <p className="relative text-center text-xs text-white/50 pb-6">
        © {new Date().getFullYear()} {company.name}
      </p>
    </div>
  );
}
