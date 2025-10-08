
import { NextResponse } from "next/server";

const HOST = process.env.RAPIDAPI_HOST || "exercisedb.p.rapidapi.com";
const KEY = process.env.RAPIDAPI_KEY;

type RawExercise = {
  id?: string | number;
  name?: string;
  bodyPart?: string;
  target?: string;
  equipment?: string;
  gifUrl?: string;
  [k: string]: any;
};

type Exercise = {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string; 
};

function sanitize(raw: RawExercise): Exercise {
  return {
    id: String(raw.id ?? crypto.randomUUID()),
    name: String(raw.name ?? "Unknown exercise"),
    bodyPart: String(raw.bodyPart ?? "full body"),
    target: String(raw.target ?? "compound"),
    equipment: String(raw.equipment ?? "body weight"),
    gifUrl: typeof raw.gifUrl === "string" ? raw.gifUrl : "",
  };
}

export async function GET(req: Request) {
  try {
    if (!KEY) {
      return NextResponse.json({ error: "Missing RAPIDAPI_KEY" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const bodyPart = searchParams.get("bodyPart");
    const query = searchParams.get("q");
    const limit = Math.max(1, Math.min(40, Number(searchParams.get("limit") || 12)));

    let url: string;
    if (query) {
      url = `https://${HOST}/exercises/name/${encodeURIComponent(query)}`;
    } else if (bodyPart) {
      url = `https://${HOST}/exercises/bodyPart/${encodeURIComponent(bodyPart)}`;
    } else {
      url = `https://${HOST}/exercises`;
    }

    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": KEY,
        "X-RapidAPI-Host": HOST,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json({ error: txt || "Upstream error" }, { status: res.status });
    }

    const json = await res.json();
    if (!Array.isArray(json)) {
      return NextResponse.json({ error: "Unexpected upstream shape" }, { status: 502 });
    }

    const list = json.map(sanitize).slice(0, limit);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
