const YT_PATTERN = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/;

export function getYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(YT_PATTERN);
  return match ? match[1] : null;
}

export function getYouTubeEmbedUrl(url: string | null | undefined): string | null {
  const id = getYouTubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
}

export function getYouTubeThumbnailUrl(url: string | null | undefined): string | null {
  const id = getYouTubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function getDirectWorkoutVideoUrl(name: string, videoUrl?: string | null): string {
  if (videoUrl && videoUrl.trim()) return videoUrl.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " exercise tutorial")}`;
}
