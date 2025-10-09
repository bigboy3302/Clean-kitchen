// app/api/workouts/gif/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cloudfrontFromId(idRaw: string) {
  const n = String(idRaw).replace(/\D+/g, "");
  if (!n) return null;
  const padded = n.padStart(4, "0");
  return `https://d205bpvrqc9yn1.cloudfront.net/${padded}.gif`;
}

async function stream(upstream: Response) {
  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: txt || `upstream-${upstream.status}` },
      { status: upstream.status }
    );
  }
  return new NextResponse(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") || "image/gif",
      "cache-control": "public, max-age=86400, immutable",
      "cross-origin-resource-policy": "cross-origin",
    },
  });
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const src = u.searchParams.get("src");
    const id = u.searchParams.get("id");
    const target = src || (id ? cloudfrontFromId(id) : null);
    if (!target) return NextResponse.json({ error: "missing-src" }, { status: 400 });

    const upstream = await fetch(target, {
      headers: { Accept: "image/*,*/*;q=0.8", "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
      cache: "no-store",
    });
    return stream(upstream);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "proxy-error" }, { status: 500 });
  }
}
