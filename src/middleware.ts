import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SEGMENT_MENU } from "./lib/menus";

const COOKIE = "genisp_session";

async function readSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    return payload as { kind?: string; role?: string };
  } catch {
    return null;
  }
}

// Cek izin menu granular via /api/roles/check (DB). Gagal/tidak ada aturan -> izinkan.
async function hasMenuAccess(req: NextRequest, menuKey: string, role: string): Promise<boolean> {
  if (role === "superadmin") return true;
  try {
    const url = new URL("/api/roles/check", req.url);
    url.searchParams.set("menu_key", menuKey);
    const res = await fetch(url, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    const j = (await res.json().catch(() => null)) as {
      ok?: boolean;
      data?: { allowed?: boolean; checked?: boolean };
    } | null;
    if (!j?.ok || !j.data) return true;
    if (!j.data.checked) return true; // tidak ada aturan eksplisit -> izinkan
    return j.data.allowed !== false;
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const s = await readSession(req);
    if (!s || s.kind !== "staff") {
      return NextResponse.redirect(new URL("/login?next=" + encodeURIComponent(pathname), req.url));
    }
    // RBAC granular per menu
    const seg = pathname.split("/")[2] ?? "";
    if (seg === "hak-akses") {
      // manajemen hak akses hanya untuk superadmin
      if (s.role !== "superadmin") return NextResponse.redirect(new URL("/dashboard", req.url));
    } else {
      const menuKey = SEGMENT_MENU[seg];
      if (menuKey && !(await hasMenuAccess(req, menuKey, s.role ?? ""))) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }
  }
  if (pathname.startsWith("/portal")) {
    const s = await readSession(req);
    if (!s || s.kind !== "member") {
      return NextResponse.redirect(new URL("/login?next=" + encodeURIComponent(pathname), req.url));
    }
  }
  if (pathname.startsWith("/partner")) {
    const s = await readSession(req);
    if (!s || s.kind !== "partner") {
      return NextResponse.redirect(new URL("/login?next=" + encodeURIComponent(pathname), req.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/portal/:path*", "/partner/:path*"],
};
