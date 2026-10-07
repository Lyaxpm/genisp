import { useCallback, useEffect, useState } from "react";

/** Error khusus untuk response API { ok:false, error } */
export class ApiError extends Error {}

/**
 * Fetch ke /api/... dengan format response { ok:true, data } | { ok:false, error }.
 * Melempar ApiError jika !ok.
 */
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(headers || {}),
    },
    body,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* abaikan body non-JSON */
  }
  if (!res.ok || (json && json.ok === false)) {
    throw new ApiError((json && json.error) || `Permintaan gagal (HTTP ${res.status})`);
  }
  return (json ? json.data : null) as T;
}

/** Hook GET sederhana: { data, loading, error, reload } */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api<T>(path));
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

/** Normalisasi payload list: dukung array langsung, {items}, atau {rows} */
export function asList<T = any>(d: any): T[] {
  if (Array.isArray(d)) return d as T[];
  if (d && Array.isArray(d.items)) return d.items as T[];
  if (d && Array.isArray(d.rows)) return d.rows as T[];
  if (d && Array.isArray(d.data)) return d.data as T[];
  return [];
}

/** Format YYYY-MM-DD untuk input date */
export function toDateInput(v?: any): string {
  if (!v) return new Date().toISOString().slice(0, 10);
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
