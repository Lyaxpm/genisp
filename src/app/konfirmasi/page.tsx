import { KonfirmasiForm, PublicShell, type Company } from "@/components/public";

async function getCompany(): Promise<Company> {
  try {
    const res = await fetch("/api/public/site", { cache: "no-store" });
    const j = await res.json();
    return { name: "GenISP", ...(j.ok && j.data?.company ? j.data.company : {}) };
  } catch {
    return { name: "GenISP" };
  }
}

export default async function KonfirmasiPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const company = await getCompany();

  return (
    <PublicShell
      company={company}
      eyebrow="Pembayaran"
      title="Konfirmasi Pembayaran Manual"
      desc="Sudah transfer via bank/e-wallet? Kirim buktinya di sini agar tagihan Anda segera diverifikasi."
    >
      <KonfirmasiForm defaultCode={searchParams.code} />
    </PublicShell>
  );
}
