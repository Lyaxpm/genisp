"use client";

/**
 * Halaman /docs — Dokumentasi API (setara Documentation::api di PTA).
 * Menampilkan Swagger UI yang dimuat dari CDN (swagger-ui-dist) saat runtime
 * saja — BUKAN dependensi build. Jika CDN gagal dimuat, tampilkan daftar
 * endpoint sederhana dari /api/docs/openapi.json.
 */
import { useEffect, useRef, useState } from "react";

const CDN_CSS = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
const CDN_JS = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";

type Spec = {
  paths: Record<string, Record<string, { summary?: string; tags?: string[] }>>;
  tags?: { name: string; description: string }[];
};

const METHOD_COLORS: Record<string, string> = {
  get: "bg-sky-600",
  post: "bg-emerald-600",
  put: "bg-amber-600",
  patch: "bg-orange-600",
  delete: "bg-rose-600",
};

function FallbackList({ spec }: { spec: Spec }) {
  const groups: Record<string, { path: string; method: string; summary: string }[]> = {};
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const tag = op.tags?.[0] ?? "Lainnya";
      (groups[tag] ||= []).push({ path, method, summary: op.summary ?? "" });
    }
  }
  const tagDesc = new Map((spec.tags ?? []).map((t) => [t.name, t.description]));
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        Swagger UI dari CDN tidak dapat dimuat (mungkin offline). Menampilkan daftar endpoint sederhana dari
        spec OpenAPI yang sama.
      </div>
      {Object.entries(groups)
        .sort(([a], [b]) => a.localeCompare(b, "id"))
        .map(([tag, items]) => (
          <section key={tag} className="rounded-lg border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <h2 className="text-lg font-semibold">{tag}</h2>
              {tagDesc.get(tag) && <p className="text-sm text-gray-500">{tagDesc.get(tag)}</p>}
            </div>
            <ul className="divide-y">
              {items
                .sort((a, b) => a.path.localeCompare(b.path))
                .map((it, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-2">
                    <span
                      className={`inline-block w-16 shrink-0 rounded px-2 py-0.5 text-center text-xs font-bold uppercase text-white ${METHOD_COLORS[it.method] ?? "bg-gray-500"}`}
                    >
                      {it.method}
                    </span>
                    <code className="text-sm">{it.path}</code>
                    {it.summary && <span className="truncate text-xs text-gray-500">{it.summary}</span>}
                  </li>
                ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

export default function DocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [spec, setSpec] = useState<Spec | null>(null);

  useEffect(() => {
    let cancelled = false;
    const failTimer = setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "loading" ? "fallback" : s));
    }, 12000);

    fetch("/api/docs/openapi.json")
      .then((r) => r.json())
      .then((data: Spec) => {
        if (!cancelled) setSpec(data);
      })
      .catch(() => {});

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CDN_CSS;
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = CDN_JS;
    script.async = true;
    script.onload = () => {
      if (cancelled) return;
      clearTimeout(failTimer);
      const w = window as unknown as { SwaggerUIBundle?: Function };
      if (w.SwaggerUIBundle && containerRef.current) {
        w.SwaggerUIBundle({
          url: "/api/docs/openapi.json",
          domNode: containerRef.current,
          deepLinking: true,
          presets: [],
        });
        setStatus("ready");
      } else {
        setStatus("fallback");
      }
    };
    script.onerror = () => {
      if (!cancelled) {
        clearTimeout(failTimer);
        setStatus("fallback");
      }
    };
    document.body.appendChild(script);

    return () => {
      cancelled = true;
      clearTimeout(failTimer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-xl font-bold">Dokumentasi API GenISP</h1>
        <p className="text-sm text-gray-500">
          Spesifikasi OpenAPI 3.0 digenerate otomatis dari route yang ada.{" "}
          <a href="/api/docs/openapi.json" className="text-sky-600 underline" target="_blank" rel="noreferrer">
            Lihat JSON mentah
          </a>
        </p>
      </header>
      {status === "loading" && (
        <div className="p-10 text-center text-gray-500">Memuat Swagger UI dari CDN…</div>
      )}
      <div ref={containerRef} style={{ display: status === "ready" ? undefined : "none" }} />
      {status === "fallback" && spec && <FallbackList spec={spec} />}
      {status === "fallback" && !spec && (
        <div className="p-10 text-center text-gray-500">
          Gagal memuat dokumentasi. Coba muat ulang halaman.
        </div>
      )}
    </div>
  );
}
