import { PublicShell, type Company } from "@/components/public";
import { TicketForms } from "./ticket-forms";

async function getData(): Promise<{ company?: Company; types?: { id: number; name: string }[] }> {
  try {
    const [siteRes, typeRes] = await Promise.all([
      fetch("/api/public/site", { cache: "no-store" }).catch(() => null),
      fetch("/api/public/help-types", { cache: "no-store" }).catch(() => null),
    ]);
    const site = siteRes && siteRes.ok ? await siteRes.json().catch(() => null) : null;
    const types = typeRes && typeRes.ok ? await typeRes.json().catch(() => null) : null;
    return {
      company: site?.ok && site.data?.company ? site.data.company : undefined,
      types: types?.ok && Array.isArray(types.data?.items) ? types.data.items : [],
    };
  } catch {
    return { types: [] };
  }
}

export default async function BantuanPage() {
  const data = await getData();
  const company: Company = { name: "GenISP", ...(data.company ?? {}) };

  return (
    <PublicShell
      company={company}
      eyebrow="Bantuan"
      title="Pusat Bantuan"
      desc="Sampaikan kendala Anda lewat tiket — tim support kami akan menindaklanjuti. Sudah punya tiket? Lacak statusnya di bawah."
    >
      <TicketForms types={data.types ?? []} />
    </PublicShell>
  );
}
