// app/api/workouts/bodyparts/route.ts
import { NextResponse } from "next/server";

const HOST = process.env.RAPIDAPI_HOST || "exercisedb.p.rapidapi.com";
const KEY = process.env.RAPIDAPI_KEY;

export async function GET() {
  try {
    if (!KEY) {
      return NextResponse.json({ error: "Missing RAPIDAPI_KEY" }, { status: 500 });
    }

    const url = `https://${HOST}/exercises/bodyPartList`;
    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": KEY,
        "X-RapidAPI-Host": HOST,
      },
      cache: "force-cache",
      next: { revalidate: 60 * 60 }, // 1 hour
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: txt || "Upstream error" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
