"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadYouTubeApi, type YTPlayer } from "@/lib/yt-player";
import {
  CAPTION_STYLES,
  fmtTime,
  type CaptionKey,
  type LayoutKey,
  type VideoDTO,
} from "@/lib/types";

type Props = {
  video: VideoDTO;
  startSec: number;
  endSec: number;
  layout: LayoutKey;
  captionStyle: CaptionKey;
  hookText: string;
  trackLabel?: string;
  accent?: string;
  onDuration?: (duration: number) => void;
};

export default function ShortsPreview({
  video,
  startSec,
  endSec,
  layout,
  captionStyle,
  hookText,
  trackLabel,
  accent = "#a855f7",
  onDuration,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(startSec);
  const [error, setError] = useState(false);
  const onDurationRef = useRef(onDuration);
  onDurationRef.current = onDuration;

  const clipDur = Math.max(0.5, endSec - startSec);
  const progress = Math.min(1, Math.max(0, (current - startSec) / clipDur));

  useEffect(() => {
    let cancelled = false;
    let player: YTPlayer | null = null;

    loadYouTubeApi()
      .then(() => {
        if (cancelled || !hostRef.current || !window.YT?.Player) return;
        player = new window.YT.Player(hostRef.current, {
          videoId: video.youtubeId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            disablekb: 1,
            iv_load_policy: 3,
            start: Math.floor(startSec),
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              playerRef.current = player;
              setReady(true);
              setError(false);
              try {
                const d = player?.getDuration?.() ?? 0;
                if (d > 0) onDurationRef.current?.(d);
              } catch {
                /* noop */
              }
            },
            onStateChange: (event: { data: number }) => {
              setPlaying(event.data === 1);
              if (event.data === 0) {
                try {
                  playerRef.current?.seekTo(startSec, true);
                } catch {
                  /* noop */
                }
              }
            },
            onError: () => setError(true),
          },
        });
      })
      .catch(() => setError(true));

    return () => {
      cancelled = true;
      try {
        player?.destroy();
      } catch {
        /* noop */
      }
      playerRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.youtubeId]);

  // Re-cue the clip whenever the trim range changes while paused.
  useEffect(() => {
    if (!ready || !playerRef.current) return;
    if (playing) {
      if (current < startSec - 0.4 || current > endSec) {
        try {
          playerRef.current.seekTo(startSec, true);
        } catch {
          /* noop */
        }
      }
      return;
    }
    try {
      playerRef.current.cueVideoById({
        videoId: video.youtubeId,
        startSeconds: Math.max(0, startSec),
        endSeconds: Math.max(startSec + 1, endSec),
      });
      setCurrent(startSec);
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, startSec, endSec]);

  // Timeline polling + loop.
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        const t = p.getCurrentTime();
        setCurrent(t);
        if (t >= endSec - 0.08) {
          p.seekTo(startSec, true);
        }
      } catch {
        /* noop */
      }
    }, 120);
    return () => window.clearInterval(id);
  }, [ready, startSec, endSec]);

  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (playing) {
        p.pauseVideo();
      } else {
        if (current < startSec || current > endSec) p.seekTo(startSec, true);
        p.playVideo();
      }
    } catch {
      /* noop */
    }
  }, [playing, current, startSec, endSec]);

  const captionClass =
    CAPTION_STYLES.find((c) => c.key === captionStyle)?.className ??
    CAPTION_STYLES[0].className;

  const frameClass =
    layout === "crop"
      ? "absolute left-1/2 top-1/2 h-full w-[316%] -translate-x-1/2 -translate-y-1/2"
      : layout === "fit"
        ? "absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2"
        : "absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2";

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative mx-auto w-full max-w-[330px]">
        <div
          className="absolute -inset-6 -z-10 rounded-[3rem] opacity-60 blur-3xl"
          style={{
            background: `radial-gradient(60% 50% at 50% 40%, ${accent}55, transparent 70%)`,
          }}
        />
        <div className="film-grain relative aspect-[9/16] w-full overflow-hidden rounded-[2rem] border border-white/15 bg-black shadow-[0_30px_80px_-30px_rgba(0,0,0,.95)]">
          {layout === "blur" && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={video.thumbnailUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-2xl"
            />
          )}
          {layout === "fit" && (
            <div className="absolute inset-0 bg-gradient-to-b from-[#0b0716] via-black to-[#0b0716]" />
          )}

          <div className={frameClass}>
            <div ref={hostRef} className="h-full w-full" />
          </div>

          {!ready && !error && (
            <div className="absolute inset-0 grid place-items-center bg-black/70 text-xs text-white/60">
              <div className="flex flex-col items-center gap-3">
                <span className="h-8 w-8 animate-spin-slow rounded-full border-2 border-white/20 border-t-fuchsia-400" />
                loading clip…
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center bg-black/85 p-6 text-center text-xs leading-relaxed text-white/70">
              Player load nahi hua (ad-block / offline?). Trim controls phir bhi
              kaam karenge — clip range set karke render script download kar lo.
            </div>
          )}

          {/* Shorts chrome */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/45 via-transparent to-black/70 p-3">
            <div className="flex items-center justify-between text-[10px] font-semibold tracking-wide text-white/85">
              <span className="flex items-center gap-1.5 rounded-full bg-red-500/85 px-2 py-0.5 uppercase">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                {clipDur.toFixed(1)}s
              </span>
              <span className="rounded-full bg-black/45 px-2 py-0.5 backdrop-blur">
                1080×1920
              </span>
            </div>

            <div className="space-y-3">
              {hookText.trim() && (
                <p
                  className={`px-2 text-center text-[22px] leading-[1.15] ${captionClass}`}
                >
                  {hookText}
                </p>
              )}
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-[11px] font-bold text-white">
                    @{video.author.replace(/\s+/g, "").toLowerCase().slice(0, 22)}
                  </p>
                  <p className="truncate text-[10px] text-white/75">
                    {video.title}
                  </p>
                  <div className="flex items-center gap-1 overflow-hidden">
                    <span className="text-[10px]">♫</span>
                    <span className="truncate text-[10px] text-white/80">
                      {trackLabel ?? "no music"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 text-[13px] text-white/85">
                  <span>❤️</span>
                  <span>💬</span>
                  <span>↗</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="w-full max-w-[330px] space-y-2">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/12">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className="btn-glow hover:btn-glow-hover grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white disabled:opacity-40"
            disabled={!ready}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <input
            type="range"
            min={startSec}
            max={endSec}
            step={0.1}
            value={Math.min(Math.max(current, startSec), endSec)}
            onChange={(e) => {
              const v = Number(e.target.value);
              setCurrent(v);
              try {
                playerRef.current?.seekTo(v, true);
              } catch {
                /* noop */
              }
            }}
            className="w-full"
            disabled={!ready}
          />
          <span className="w-20 shrink-0 text-right font-mono text-[11px] text-white/55">
            {fmtTime(Math.max(0, current - startSec))} / {fmtTime(clipDur)}
          </span>
        </div>
      </div>
    </div>
  );
}
