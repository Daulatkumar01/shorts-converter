"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMOS = [
  { label: "🎬 Big Buck Bunny (10 min)", url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" },
  { label: "🎵 Rick Astley (3 min)", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
];

export default function UrlBar() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async (value: string) => {
    if (!value.trim()) {
      setError("Pehle koi YouTube link paste karo 🙂");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/videos/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const data = (await res.json()) as {
        video?: { id: number };
        error?: string;
      };
      if (!res.ok || !data.video) {
        throw new Error(data.error || "Link resolve nahi hua");
      }
      router.push(`/studio/${data.video.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuch gadbad ho gayi");
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void go(url);
        }}
        className="glass group flex flex-col gap-2 rounded-2xl p-2 sm:flex-row sm:items-center"
      >
        <span className="hidden pl-3 text-sm text-white/35 sm:block">🔗</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-white/30"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-glow hover:btn-glow-hover shrink-0 rounded-xl px-5 py-3 text-[13px] font-extrabold text-white disabled:opacity-60"
        >
          {loading ? "Loading…" : "Shorts banao →"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-white/35">Try:</span>
        {DEMOS.map((d) => (
          <button
            key={d.url}
            type="button"
            onClick={() => {
              setUrl(d.url);
              void go(d.url);
            }}
            className="rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            {d.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-[12px] text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
