export type YtMeta = {
  youtubeId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
};

const ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/** Accepts watch / youtu.be / shorts / embed / live links or a bare id. */
export function parseYouTubeId(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  if (ID_RE.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && ID_RE.test(id) ? id : null;
  }
  if (!host.endsWith("youtube.com") && !host.endsWith("youtube-nocookie.com")) {
    return null;
  }

  const v = url.searchParams.get("v");
  if (v && ID_RE.test(v)) return v;

  const parts = url.pathname.split("/").filter(Boolean);
  const keyed = ["shorts", "embed", "live", "v"];
  for (let i = 0; i < parts.length; i++) {
    if (keyed.includes(parts[i])) {
      const id = parts[i + 1];
      if (id && ID_RE.test(id)) return id;
    }
  }
  return null;
}

export function thumbFor(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}

/** oEmbed needs no API key. Falls back gracefully when offline. */
export async function fetchYtMeta(youtubeId: string): Promise<YtMeta> {
  const fallback: YtMeta = {
    youtubeId,
    title: `YouTube video · ${youtubeId}`,
    author: "Unknown channel",
    thumbnailUrl: thumbFor(youtubeId),
  };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${youtubeId}`,
      )}&format=json`,
      { signal: controller.signal, cache: "no-store" },
    );
    clearTimeout(timer);
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      youtubeId,
      title: data.title?.trim() || fallback.title,
      author: data.author_name?.trim() || fallback.author,
      thumbnailUrl: data.thumbnail_url || fallback.thumbnailUrl,
    };
  } catch {
    return fallback;
  }
}
