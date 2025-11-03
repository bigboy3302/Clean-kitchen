const BASE_URL = "https://wger.de/api/v2";

type WgerExercise = {
  id: number;
  name: string;
  description: string;
};

type WgerResponse = {
  results: WgerExercise[];
};

const cache = new Map<string, { descriptionHtml: string; descriptionText: string }>();

function cleanHtml(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  const strippedHandlers = withoutScripts.replace(/ on[a-z]+="[^"]*"/gi, "");
  return strippedHandlers.replace(/<(?!\/?(p|ul|ol|li|strong|em|br)\b)[^>]*>/gi, "");
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?\>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/(p|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchWgerDescription(name: string): Promise<{ descriptionHtml: string; descriptionText: string } | null> {
  const key = name.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const url = new URL(`${BASE_URL}/exercise/`);
  url.searchParams.set("language", "2");
  url.searchParams.set("search", name);
  url.searchParams.set("limit", "5");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as WgerResponse;
  const first = data.results?.find((item) => item && item.description?.trim());
  if (!first) return null;

  const safeHtml = cleanHtml(first.description || "");
  const text = htmlToText(safeHtml);
  const payload = { descriptionHtml: safeHtml, descriptionText: text };
  cache.set(key, payload);
  return payload;
}
