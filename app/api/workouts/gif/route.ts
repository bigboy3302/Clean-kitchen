// app/api/workouts/gif/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

function normalizeUrl(raw: string | null): URL | null {
  try {
    if (!raw) return null;
    let s = raw.trim();
    if (!s) return null;
    if (s.startsWith("//")) s = "https:" + s;
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    const u = new URL(s);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u;
  } catch {
    return null;
  }
}

function cloudfrontUrlFromId(idRaw: string): string | null {
  const digits = (idRaw || "").toString().match(/\d+/)?.[0] || "";
  if (!digits) return null;
  const id = digits.length >= 4 ? digits : digits.padStart(4, "0");
  return `https://d205bpvrqc9yn1.cloudfront.net/${id}.gif`;
}

function redirectTo(url: string) {
  return NextResponse.redirect(url, {
    status: 307,
    headers: {
      "cache-control": "public, max-age=86400, immutable",
      "cross-origin-resource-policy": "cross-origin",
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const id = (u.searchParams.get("id") || "").trim();
    const src = u.searchParams.get("src");

    if (src) {
      const url = normalizeUrl(src);
      if (!url) return NextResponse.json({ error: "bad-src" }, { status: 400 });
      return redirectTo(url.toString());
    }

    if (id) {
      const cloud = cloudfrontUrlFromId(id);
      if (!cloud) return NextResponse.json({ error: "invalid-id" }, { status: 400 });
      return redirectTo(cloud);
    }

    return NextResponse.json({ error: "missing-id-or-src" }, { status: 400 });
  } catch (error: unknown) {
    console.error("GET /api/workouts/gif failed:", error);
    const message = error instanceof Error && error.message ? error.message : "proxy-error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
