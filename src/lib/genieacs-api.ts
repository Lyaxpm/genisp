import { getSession } from "./auth";
import { GenieError } from "./genieacs";
import { fail } from "./utils";

export async function genieStaff() {
  const session = await getSession("genieacs");
  if (!session || session.kind !== "staff") throw new GenieError("Akses GenieACS ditolak", 403);
  return session;
}
export function genieFailure(error: unknown) {
  if (error instanceof GenieError) return fail(error.message, error.status);
  console.error("GenieACS operation failed", error instanceof Error ? error.name : "UnknownError");
  return fail("Operasi GenieACS gagal. Periksa koneksi database dan migrasi.", 500);
}
export function deviceId(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 512) throw new GenieError("ID perangkat tidak valid", 400);
  return value;
}
