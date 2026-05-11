import { NextResponse } from "next/server";

type MyMemoryResponse = {
  responseStatus: number;
  responseData?: { translatedText?: string };
};

async function translateOne(term: string): Promise<string> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=autodetect|en`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return term;
    const data = (await res.json()) as MyMemoryResponse;
    const translated = data?.responseData?.translatedText?.trim();
    if (translated && data.responseStatus === 200) return translated.toLowerCase();
    return term;
  } catch {
    return term;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    if (
      !body ||
      typeof body !== "object" ||
      !Array.isArray((body as Record<string, unknown>).terms)
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const terms: string[] = (body as { terms: string[] }).terms
      .map((t) => String(t).trim())
      .filter(Boolean);

    if (!terms.length) {
      return NextResponse.json({ translations: [] });
    }

    const translations = await Promise.all(terms.map(translateOne));
    return NextResponse.json({ translations });
  } catch (err) {
    console.error("[translate-ingredients]", err);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
