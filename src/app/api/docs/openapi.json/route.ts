import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/openapi";

export const dynamic = "force-dynamic";

/**
 * GET /api/docs/openapi.json
 * Menyajikan spesifikasi OpenAPI 3.0 (JSON) yang digenerate dari route
 * yang benar-benar ada (setara Documentation::openapi di PTA).
 * Spec di-generate sekali lalu di-cache di memori.
 */
let cachedSpec: ReturnType<typeof buildOpenApiSpec> | null = null;
let cachedAt = "";

export async function GET() {
  if (!cachedSpec) {
    cachedSpec = buildOpenApiSpec();
    cachedAt = new Date().toISOString();
  }
  return NextResponse.json(
    { ...cachedSpec, "x-generated-at": cachedAt },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}
