import { cookies } from "next/headers";
import { TiketClient } from "./tiket-client";
import type { Customer } from "@/components/public";

async function getJSON(path: string) {
  try {
    const res = await fetch(path, {
      headers: { Cookie: cookies().toString() },
      cache: "no-store",
    });
    const j = await res.json().catch(() => null);
    return j && j.ok ? j.data : null;
  } catch {
    return null;
  }
}

export default async function PortalTiketPage() {
  const [typesData, meData] = await Promise.all([
    getJSON("/api/public/help-types"),
    getJSON("/api/portal/me"),
  ]);
  const types = Array.isArray(typesData?.items) ? typesData.items : [];
  const customer = (meData?.customer ?? meData ?? null) as Customer | null;

  return <TiketClient types={types} customer={customer} />;
}
