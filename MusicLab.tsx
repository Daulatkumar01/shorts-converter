"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MusicPlayer, renderTrackToWav } from "@/lib/music";
import type { TrackDTO } from "@/lib/types";

type Props = {
  tracks: TrackDTO[];
  trackId: number | null;
  onSelect: (id: number | null) => void;
  musicVolume: number;
  onVolume: (v: number) => void;
  durationSec: number;
};

const BARS = 30;

export default function MusicLab({
  tracks,
  trackId,
  onSelect,
  musicVolume,
  onVolume,
  durationSec,
}: Props) {
  const playerRef = useRef<MusicPlayer | null>(null);
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [mood, setMood] = useState("all");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const moods = useMemo(() => {
    const set = new Set(tracks.map((t) => t.mood));
    return ["all", ...Array.from(set)];
  }, [tracks]);

  const visible = useMemo(
    () => (mood === "all" ? tracks : tracks.filter((t) => t.mood === mood)),
    [tracks, mood],
  );

  const selected = tracks.find((t) => t.id === trackId) ?? null;

  useEffect(() => {
    if (!playerRef.current) playerRef.current = new MusicPlayer();
    const player = playerRef.current;
    player.setVolume(Math.pow(musicVolume / 100, 1.35));
  }, [musicVolume]);

  // Visualiser loop (direct DOM writes, no re-renders).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const levels = playerRef.current?.levels(BARS) ?? [];
      barsRef.current.forEach((el, i) => {
        if (!el) return;
        const v = levels[i] ?? 0;
        el.style.transform = `scaleY(${0.12 + v * 0.88})`;
        el.style.opacity = String(0.4 + v * 0.6);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => () => playerRef.current?.stop(), []);

  const toggleTrack = async (track: TrackDTO) => {
    if (!playerRef.current) playerRef.current = new MusicPlayer();
    const player = playerRef.current;
    if (playingId === track.id) {
      player.stop();
      setPlayingId(null);
      return;
    }
    onSelect(track.id);
    player.setVolume(Math.pow(musicVolume / 100, 1.35));
    await player.play(track, Math.max(12, durationSec));
    setPlayingId(track.id);
  };

  const surprise = () => {
    const pool = tracks.filter((t) => t.id !== trackId);
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? tracks[0];
    if (pick) void toggleTrack(pick);
  };

  const downloadStem = async () => {
    if (!selected) return;
    setBusy(true);
    setNote(null);
    try {
      const len = Math.min(Math.max(durationSec, 15), selected.durationSec);
      const blob = await renderTrackToWav(selected, len);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selected.slug}-${Math.round(len)}s.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNote(`${selected.slug}.wav ready — ${len}s, 44.1kHz stereo`);
    } catch {
      setNote("Render fail hua. Browser Web Audio support check karo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass rounded-3xl p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold tracking-tight">
            🎧 Copyright-free music bed
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-white/45">
            Har track browser me live synthesise hota hai — koi sample nahi, koi
            Content ID claim nahi.
          </p>
        </div>
        <button
          type="button"
          onClick={surprise}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:bg-white/10"
        >
          ✨ Surprise me
        </button>
      </div>

      {/* now playing / visualiser */}
      <div
        className="relative mb-4 overflow-hidden rounded-2xl border border-white/10 p-4"
        style={{
          background: `linear-gradient(120deg, ${selected?.accent ?? "#a855f7"}22, transparent 70%)`,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {selected ? selected.title : "Koi music nahi selected"}
            </p>
            <p className="mt-0.5 text-[11px] text-white/50">
              {selected
                ? `${selected.mood} · ${selected.bpm} BPM · seed ${selected.seed}`
                : "neeche se koi track chuno"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selected && (
              <button
                type="button"
                onClick={() => {
                  if (playingId === selected.id) {
                    playerRef.current?.stop();
                    setPlayingId(null);
                  } else {
                    void toggleTrack(selected);
                  }
                }}
                className="btn-glow hover:btn-glow-hover grid h-9 w-9 place-items-center rounded-full text-xs text-white"
                aria-label="Preview music"
              >
                {playingId === selected.id ? "❚❚" : "▶"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex h-12 items-end gap-[3px]">
          {Array.from({ length: BARS }).map((_, i) => (
            <span
              key={i}
              ref={(el) => {
                barsRef.current[i] = el;
              }}
              className="h-full flex-1 origin-bottom rounded-sm transition-transform duration-75"
              style={{
                background: `linear-gradient(to top, ${selected?.accent ?? "#a855f7"}, #67e8f9)`,
                transform: "scaleY(0.12)",
              }}
            />
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/60">
              Music volume <span>{musicVolume}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={musicVolume}
              onChange={(e) => onVolume(Number(e.target.value))}
              className="w-full"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={downloadStem}
              disabled={!selected || busy}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/85 transition hover:bg-white/10 disabled:opacity-40"
            >
              {busy ? "⏳ Rendering WAV…" : "⬇ Download music stem (.wav)"}
            </button>
          </div>
        </div>
        {note && <p className="mt-2 text-[11px] text-cyan-300/80">{note}</p>}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {moods.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMood(m)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
              mood === m
                ? "bg-white/90 text-black"
                : "border border-white/12 bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {m}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
            trackId === null
              ? "bg-white/90 text-black"
              : "border border-white/12 bg-white/5 text-white/60 hover:bg-white/10"
          }`}
        >
          no music
        </button>
      </div>

      <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {visible.map((track) => {
          const active = track.id === trackId;
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => void toggleTrack(track)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                active
                  ? "border-white/25 bg-white/10"
                  : "border-white/8 bg-white/[0.03] hover:bg-white/[0.07]"
              }`}
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] text-black/80"
                style={{ background: track.accent }}
              >
                {playingId === track.id ? "❚❚" : "▶"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold">
                    {track.title}
                  </span>
                  <span className="rounded-full bg-white/10 px-1.5 py-[1px] text-[9px] uppercase tracking-wide text-white/55">
                    {track.mood}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-white/40">
                  {track.artist} · {track.bpm} BPM · {track.drums} drums
                </span>
              </span>
              <span className="shrink-0 text-[10px] font-semibold text-emerald-300/70">
                free
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
