import { DaftarForm, PublicShell, type Company, type Pkg } from "@/components/public";

async function getSite(): Promise<{ company?: Company; packages?: Pkg[] }> {
  try {
    const res = await fetch("/api/public/site", { cache: "no-store" });
    if (!res.ok) return {};
    const j = await res.json();
    return j.ok && j.data ? (j.data as { company?: Company; packages?: Pkg[] }) : {};
  } catch {
    return {};
  }
}

export default async function DaftarPage({
  searchParams,
}: {
  searchParams: { paket?: string };
}) {
  const site = await getSite();
  const company: Company = { name: "GenISP", ...(site.company ?? {}) };

  return (
    <PublicShell
      company={company}
      eyebrow="Berlangganan"
      title="Formulir Pendaftaran"
      desc="Isi data di bawah ini. Tim kami akan menghubungi Anda untuk survei dan penjadwalan pemasangan."
    >
      <DaftarForm packages={site.packages ?? []} defaultPaket={searchParams.paket} />
    </PublicShell>
  );
}
