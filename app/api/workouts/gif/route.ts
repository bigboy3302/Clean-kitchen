// app/api/workouts/gif/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOST = process.env.RAPIDAPI_HOST || "exercisedb.p.rapidapi.com";
const KEY  = process.env.RAPIDAPI_KEY;

// Normalize arbitrary URL strings to http/https
function normalizeUrl(srcRaw: string): URL | null {
  try {
    let src = (srcRaw || "").trim();
    if (!src) return null;
    if (src.startsWith("//")) src = "https:" + src;
    if (!/^https?:\/\//i.test(src)) src = "https://" + src;
    const url = new URL(src);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
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
    // accept either ?id=1234 or ?exerciseId=1234
    const id = (u.searchParams.get("id") || u.searchParams.get("exerciseId") || "").trim();
    const res = (u.searchParams.get("res") || "360").trim(); // 180/360/720/1080
    const src = u.searchParams.get("src"); // explicit fallback

    // ---------- Preferred: by exercise id ----------
    if (id) {
      // 1) RapidAPI image endpoint (doesn't expose your key to client)
      if (KEY) {
        try {
          const rapidUrl = `https://${HOST}/image?exerciseId=${encodeURIComponent(id)}&resolution=${encodeURIComponent(res)}`;
          const upstream = await fetch(rapidUrl, {
            method: "GET",
            headers: {
              "X-RapidAPI-Key": KEY,
              "X-RapidAPI-Host": HOST,
              "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
            },
            redirect: "follow",
            cache: "no-store",
          });
          if (upstream.ok) return stream(upstream);
          // fall through to legacy CDN if RapidAPI returns non-ok
          // (lots of free-plan throttling)
        } catch (e) {
          // fall through to legacy CDN
          // console.error("RapidAPI image fetch failed", e);
        }
      }

      // 2) Legacy CloudFront pattern (works for numeric IDs like 0037)
      try {
        const legacy = `https://d205bpvrqc9yn1.cloudfront.net/exerciseGif/${encodeURIComponent(id)}.gif`;
        const upstream = await fetch(legacy, {
          method: "GET",
          headers: {
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
          },
          redirect: "follow",
          cache: "no-store",
        });
        if (upstream.ok) return stream(upstream);
      } catch (e) {
        // console.error("CloudFront fallback failed", e);
      }

      return NextResponse.json(
        { error: "image-not-found", tried: ["rapidapi", "cloudfront"], id },
        { status: 404 }
      );
    }

    // ---------- Explicit src fallback ----------
    if (src) {
      const url = normalizeUrl(src);
      if (!url) return NextResponse.json({ error: "bad-src" }, { status: 400 });

      const upstream = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        },
        redirect: "follow",
        cache: "no-store",
      });
      return stream(upstream);
    }

    return NextResponse.json({ error: "missing-id-or-src" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "proxy-error" }, { status: 500 });
  }
}
