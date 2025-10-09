import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function pipe(upstream: Response) {
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: text || `upstream-${upstream.status}` },
      { status: upstream.status || 502 }
    );
  }
  const ct = upstream.headers.get("content-type") || "image/gif";
  return new NextResponse(upstream.body, {
    headers: {
      "content-type": ct,
      "cache-control": "public, max-age=86400, immutable",
      "cross-origin-resource-policy": "cross-origin",
    },
  });
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const id = (u.searchParams.get("id") || "").trim();
    const src = u.searchParams.get("src");

    if (src) {
      const url = normalizeUrl(src);
      if (!url) return NextResponse.json({ error: "bad-src" }, { status: 400 });
      const res = await fetch(url.toString(), {
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        },
        redirect: "follow",
        cache: "no-store",
      });
      return pipe(res);
    }

    if (id) {
      const cloud = cloudfrontUrlFromId(id);
      if (!cloud) return NextResponse.json({ error: "invalid-id" }, { status: 400 });
      const res = await fetch(cloud, {
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        },
        redirect: "follow",
        cache: "no-store",
      });
      return pipe(res);
    }

    return NextResponse.json({ error: "missing-id-or-src" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "proxy-error" },
      { status: 500 }
    );
  }
}
