"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import MusicLab from "@/components/MusicLab";
import PublishPanel from "@/components/PublishPanel";
import ShortsPreview from "@/components/ShortsPreview";
import { buildRenderScript } from "@/lib/render-script";
import {
  CAPTION_STYLES,
  LAYOUTS,
  STATUS_LABEL,
  fmtBytes,
  fmtTime,
  type CaptionKey,
  type LayoutKey,
  type ProjectDTO,
  type TrackDTO,
  type VideoDTO,
} from "@/lib/types";

type Props = {
  video: VideoDTO;
  tracks: TrackDTO[];
  initialProject: ProjectDTO | null;
  initialShorts: ProjectDTO[];
  suggestedTrackId: number | null;
};

const TABS = [
  { key: "cut", label: "✂️ Cut", hint: "Trim the short" },
  { key: "style", label: "🎨 Style", hint: "Layout + captions" },
  { key: "music", label: "🎧 Music", hint: "Background score" },
  { key: "export", label: "🚀 Export", hint: "Render + download" },
  { key: "publish", label: "📤 Publish", hint: "Auto title + upload" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

export default function StudioClient({
  video,
  tracks,
  initialProject,
  initialShorts,
  suggestedTrackId,
}: Props) {
  const [duration, setDuration] = useState(
    video.durationSec > 0 ? video.durationSec : 600,
  );
  const [startSec, setStartSec] = useState(initialProject?.startSec ?? 0);
  const [endSec, setEndSec] = useState(initialProject?.endSec ?? 30);
  const [layout, setLayout] = useState<LayoutKey>(
    (initialProject?.layout as LayoutKey) ?? "blur",
  );
  const [captionStyle, setCaptionStyle] = useState<CaptionKey>(
    (initialProject?.captionStyle as CaptionKey) ?? "bold",
  );
  const [hookText, setHookText] = useState(initialProject?.hookText ?? "");
  const [title, setTitle] = useState(
    initialProject?.title ??
      `${video.title.split(/[|—-]/)[0].trim().slice(0, 48)} — Short`,
  );
  const [trackId, setTrackId] = useState<number | null>(
    initialProject?.trackId ?? suggestedTrackId ?? null,
  );
  const [musicVolume, setMusicVolume] = useState(
    initialProject?.musicVolume ?? 35,
  );
  const [duckVolume, setDuckVolume] = useState(initialProject?.duckVolume ?? 60);

  const [projectId, setProjectId] = useState<number | null>(
    initialProject?.id ?? null,
  );
  const [status, setStatus] = useState(initialProject?.status ?? "draft");
  const [progress, setProgress] = useState(initialProject?.renderProgress ?? 0);
  const [outputBytes, setOutputBytes] = useState(
    initialProject?.outputBytes ?? 0,
  );

  const [tab, setTab] = useState<TabKey>("cut");
  const [shorts, setShorts] = useState<ProjectDTO[]>(initialShorts);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [splitCount, setSplitCount] = useState(4);
  const reportedRef = useRef(false);

  const clipDur = Math.max(0, endSec - startSec);
  const selectedTrack = tracks.find((t) => t.id === trackId) ?? null;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const script = useMemo(
    () =>
      projectId
        ? buildRenderScript(
            {
              id: projectId,
              videoId: video.id,
              trackId,
              title,
              hookText,
              startSec,
              endSec,
              layout,
              captionStyle,
              musicVolume,
              duckVolume,
              status,
              renderProgress: progress,
              outputBytes,
              updatedAt: new Date().toISOString(),
            },
            video,
            selectedTrack,
          )
        : "",
    [
      projectId,
      video,
      selectedTrack,
      trackId,
      title,
      hookText,
      startSec,
      endSec,
      layout,
      captionStyle,
      musicVolume,
      duckVolume,
      status,
      progress,
      outputBytes,
    ],
  );

  const refreshShorts = useCallback(async () => {
    const data = await api<{ projects: ProjectDTO[] }>(
      `/api/projects?videoId=${video.id}`,
    );
    setShorts(data.projects);
  }, [video.id]);

  const handleDuration = useCallback(
    (d: number) => {
      if (!Number.isFinite(d) || d <= 0) return;
      setDuration(d);
      setEndSec((e) => Math.min(e, d));
      if (reportedRef.current) return;
      reportedRef.current = true;
      void api(`/api/videos/${video.id}`, {
        method: "PATCH",
        body: JSON.stringify({ durationSec: d }),
      }).catch(() => undefined);
    },
    [video.id],
  );

  const moveStart = (value: number) => {
    const v = Math.max(0, Math.min(value, endSec - 3));
    setStartSec(Number(v.toFixed(1)));
  };

  const moveEnd = (value: number) => {
    const v = Math.min(duration, Math.max(value, startSec + 3));
    setEndSec(Number(v.toFixed(1)));
  };

  const applyPreset = (len: number) => {
    const s = Math.min(startSec, Math.max(0, duration - len));
    setStartSec(Number(s.toFixed(1)));
    setEndSec(Number(Math.min(duration, s + len).toFixed(1)));
  };

  const shiftClip = (delta: number) => {
    const len = clipDur;
    const s = Math.max(0, Math.min(duration - len, startSec + delta));
    setStartSec(Number(s.toFixed(1)));
    setEndSec(Number(Math.min(duration, s + len).toFixed(1)));
  };

  const payload = useCallback(
    () => ({
      videoId: video.id,
      trackId,
      title,
      hookText,
      startSec,
      endSec,
      layout,
      captionStyle,
      musicVolume,
      duckVolume,
    }),
    [
      video.id,
      trackId,
      title,
      hookText,
      startSec,
      endSec,
      layout,
      captionStyle,
      musicVolume,
      duckVolume,
    ],
  );

  const save = useCallback(
    async (silent = false): Promise<number | null> => {
      setBusy("save");
      let savedId: number | null = null;
      try {
        if (projectId) {
          const data = await api<{ project: ProjectDTO }>(
            `/api/projects/${projectId}`,
            { method: "PATCH", body: JSON.stringify(payload()) },
          );
          savedId = data.project.id;
          setProjectId(data.project.id);
          setStatus(data.project.status);
          setProgress(data.project.renderProgress);
          if (!silent) flash("Changes save ho gaye ✅");
        } else {
          const data = await api<{ project: ProjectDTO }>("/api/projects", {
            method: "POST",
            body: JSON.stringify(payload()),
          });
          savedId = data.project.id;
          setProjectId(data.project.id);
          setStatus(data.project.status);
          flash("Short create ho gaya 🎉");
        }
        await refreshShorts();
        return savedId;
      } catch (err) {
        flash(err instanceof Error ? err.message : "Save fail");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [payload, projectId, refreshShorts, flash],
  );

  const startRender = async () => {
    let id = projectId;
    if (!id) {
      id = await save(true);
      if (!id) return;
    }
    setTab("export");
    try {
      const data = await api<{ project: ProjectDTO }>(
        `/api/projects/${id}/render`,
        { method: "POST" },
      );
      setProjectId(data.project.id);
      setStatus(data.project.status);
      setProgress(data.project.renderProgress);
      await refreshShorts();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Render start fail");
    }
  };

  // Poll while the render job is running.
  useEffect(() => {
    if (status !== "rendering" || !projectId) return;
    const id = window.setInterval(async () => {
      try {
        const data = await api<{ project: ProjectDTO }>(
          `/api/projects/${projectId}/render`,
          { method: "POST" },
        );
        setStatus(data.project.status);
        setProgress(data.project.renderProgress);
        setOutputBytes(data.project.outputBytes);
        if (data.project.status !== "rendering") {
          await refreshShorts();
          flash("Render complete! 🎬");
        }
      } catch {
        /* keep polling */
      }
    }, 900);
    return () => window.clearInterval(id);
  }, [status, projectId, refreshShorts, flash]);

  const autoSplit = async () => {
    setBusy("split");
    try {
      const len = Math.max(10, Math.min(60, Math.round(clipDur)));
      const count = Math.max(1, Math.min(10, splitCount));
      const maxStart = Math.max(0, duration - len);
      for (let i = 0; i < count; i++) {
        const s = Math.min(
          maxStart,
          Math.round((maxStart * i) / Math.max(1, count - (maxStart > 0 ? 1 : 0))),
        );
        await api("/api/projects", {
          method: "POST",
          body: JSON.stringify({
            ...payload(),
            title: `${title} · part ${i + 1}`,
            startSec: s,
            endSec: Math.min(duration, s + len),
            hookText: hookText || video.title.slice(0, 60),
          }),
        });
      }
      await refreshShorts();
      flash(`${count} shorts ban gaye ✂️`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Auto split fail");
    } finally {
      setBusy(null);
    }
  };

  const loadShort = (short: ProjectDTO) => {
    setProjectId(short.id);
    setStartSec(short.startSec);
    setEndSec(short.endSec);
    setLayout(short.layout as LayoutKey);
    setCaptionStyle(short.captionStyle as CaptionKey);
    setHookText(short.hookText);
    setTitle(short.title);
    setTrackId(short.trackId);
    setMusicVolume(short.musicVolume);
    setDuckVolume(short.duckVolume);
    setStatus(short.status);
    setProgress(short.renderProgress);
    setOutputBytes(short.outputBytes);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeShort = async (id: number) => {
    await api(`/api/projects/${id}`, { method: "DELETE" });
    if (projectId === id) setProjectId(null);
    await refreshShorts();
    flash("Deleted");
  };

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(script);
      flash("Render script copy ho gaya 📋");
    } catch {
      flash("Copy fail — script select karke manually copy karo");
    }
  };

  const timelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const frac = (event.clientX - rect.left) / rect.width;
    const len = Math.max(3, Math.min(clipDur, duration));
    const s = Math.max(0, Math.min(duration - len, frac * duration));
    setStartSec(Number(s.toFixed(1)));
    setEndSec(Number(Math.min(duration, s + len).toFixed(1)));
  };

  return (
    <div className="space-y-8">
      {toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-rise rounded-full border border-white/15 bg-[#12101c]/95 px-4 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur">
          {toast}
        </div>
      )}

      <header className="glass animate-rise flex flex-wrap items-center gap-4 rounded-3xl p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnailUrl}
          alt=""
          className="h-16 w-28 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold sm:text-lg">
            {video.title}
          </h1>
          <p className="mt-0.5 text-xs text-white/50">
            {video.author} · {fmtTime(duration)} total · video #{video.id}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              status === "ready"
                ? "bg-emerald-400/15 text-emerald-300"
                : status === "rendering"
                  ? "bg-amber-400/15 text-amber-300"
                  : "bg-white/10 text-white/60"
            }`}
          >
            {STATUS_LABEL[status] ?? status}
            {status === "rendering" ? ` ${progress}%` : ""}
          </span>
          <a
            href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/75 transition hover:bg-white/10"
          >
            ↗ YouTube
          </a>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy === "save"}
            className="btn-glow hover:btn-glow-hover rounded-full px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <ShortsPreview
            video={video}
            startSec={startSec}
            endSec={endSec}
            layout={layout}
            captionStyle={captionStyle}
            hookText={hookText}
            trackLabel={selectedTrack ? `${selectedTrack.title} · ${selectedTrack.mood}` : undefined}
            accent={selectedTrack?.accent}
            onDuration={handleDuration}
          />
        </div>

        <div className="space-y-5">
          <div className="glass flex flex-wrap gap-1 rounded-2xl p-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-xl px-3 py-2 text-[12px] font-bold transition ${
                  tab === t.key
                    ? "bg-gradient-to-r from-fuchsia-500/90 to-violet-600/90 text-white shadow-lg"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "cut" && (
            <section className="glass animate-rise space-y-5 rounded-3xl p-5">
              <div>
                <h3 className="text-sm font-bold">✂️ Clip trim</h3>
                <p className="mt-1 text-[11px] text-white/45">
                  Long video ka jo part Shorts banana hai usse select karo.
                  Click on timeline to jump.
                </p>
              </div>

              <div
                onClick={timelineClick}
                className="relative h-14 cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(90deg,rgba(168,85,247,.18),rgba(6,182,212,.18))]"
              >
                {Array.from({ length: 40 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute top-0 h-full w-px bg-white/8"
                    style={{ left: `${(i / 40) * 100}%` }}
                  />
                ))}
                <div
                  className="absolute inset-y-0 rounded-lg border-2 border-fuchsia-400/80 bg-fuchsia-400/20 shadow-[0_0_24px_-4px_rgba(217,70,239,.8)]"
                  style={{
                    left: `${(startSec / duration) * 100}%`,
                    width: `${(clipDur / duration) * 100}%`,
                  }}
                >
                  <span className="absolute -top-0 left-1 right-1 truncate text-[10px] font-bold text-white/90">
                    {fmtTime(startSec)} → {fmtTime(endSec)}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 flex justify-between text-[11px] font-semibold text-white/60">
                    Start <span className="font-mono">{fmtTime(startSec)}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(3, duration)}
                    step={0.5}
                    value={startSec}
                    onChange={(e) => moveStart(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 flex justify-between text-[11px] font-semibold text-white/60">
                    End <span className="font-mono">{fmtTime(endSec)}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(3, duration)}
                    step={0.5}
                    value={endSec}
                    onChange={(e) => moveEnd(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-white/50">
                  Length:
                </span>
                {[15, 30, 45, 60].map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => applyPreset(len)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                      Math.abs(clipDur - len) < 0.6
                        ? "bg-white/90 text-black"
                        : "border border-white/12 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {len}s
                  </button>
                ))}
                <span className="ml-2 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-cyan-300">
                  {clipDur.toFixed(1)}s clip
                </span>
                <div className="ml-auto flex gap-1">
                  {[-5, -1, 1, 5].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => shiftClip(d)}
                      className="rounded-lg border border-white/12 bg-white/5 px-2 py-1 text-[11px] font-bold text-white/70 transition hover:bg-white/10"
                    >
                      {d > 0 ? `+${d}` : d}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] font-bold text-white/70">
                  ⚡ Auto split — ek video se poori series
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {[2, 3, 5, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSplitCount(n)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                        splitCount === n
                          ? "bg-white/90 text-black"
                          : "border border-white/12 bg-white/5 text-white/65 hover:bg-white/10"
                      }`}
                    >
                      {n} parts
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void autoSplit()}
                    disabled={busy === "split"}
                    className="ml-auto rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-3.5 py-1.5 text-[11px] font-bold text-black/85 disabled:opacity-50"
                  >
                    {busy === "split" ? "Cutting…" : "Generate series"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {tab === "style" && (
            <section className="glass animate-rise space-y-5 rounded-3xl p-5">
              <div>
                <h3 className="text-sm font-bold">🎨 Look &amp; captions</h3>
                <p className="mt-1 text-[11px] text-white/45">
                  9:16 framing + hook text. Preview live update hota hai.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setLayout(l.key)}
                    className={`rounded-2xl border p-3 text-left transition ${
                      layout === l.key
                        ? "border-fuchsia-400/60 bg-fuchsia-400/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                    }`}
                  >
                    <span className="text-lg">{l.icon}</span>
                    <span className="mt-1 block text-[12px] font-bold">
                      {l.label}
                    </span>
                    <span className="block text-[10px] leading-tight text-white/45">
                      {l.hint}
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CAPTION_STYLES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCaptionStyle(c.key)}
                    className={`rounded-xl border px-3 py-2.5 text-[11px] transition ${
                      captionStyle === c.key
                        ? "border-cyan-300/60 bg-cyan-300/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                    }`}
                  >
                    <span
                      className={`block text-[15px] leading-tight ${c.className}`}
                    >
                      Aa
                    </span>
                    <span className="mt-1 block text-[10px] font-semibold text-white/55">
                      {c.label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-white/60">
                    Hook / caption text
                  </span>
                  <textarea
                    value={hookText}
                    onChange={(e) => setHookText(e.target.value)}
                    rows={3}
                    maxLength={240}
                    placeholder="Ye 30 second me aapki life badal degi…"
                    className="w-full resize-none rounded-xl border border-white/12 bg-black/40 px-3 py-2 text-sm outline-none transition placeholder:text-white/25 focus:border-fuchsia-400/60"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-white/60">
                    Short ka title
                  </span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2 text-sm outline-none transition focus:border-fuchsia-400/60"
                  />
                </label>
              </div>
            </section>
          )}

          {tab === "music" && (
            <div className="animate-rise">
              <MusicLab
                tracks={tracks}
                trackId={trackId}
                onSelect={setTrackId}
                musicVolume={musicVolume}
                onVolume={setMusicVolume}
                durationSec={Math.max(10, clipDur)}
              />
              <section className="glass mt-5 rounded-3xl p-5">
                <h3 className="text-sm font-bold">🎚️ Audio balance</h3>
                <p className="mt-1 text-[11px] text-white/45">
                  Original voice ka level jab music chal raha ho.
                </p>
                <label className="mt-3 block">
                  <span className="mb-1 flex justify-between text-[11px] font-semibold text-white/60">
                    Original audio (duck) <span>{duckVolume}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={duckVolume}
                    onChange={(e) => setDuckVolume(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
                <p className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-[11px] leading-relaxed text-emerald-200/80">
                  ✅ Safe: ye music engine khud synth karta hai — koi sample,
                  koi record label, koi copyright claim nahi. YouTube / Reels /
                  Shorts par monetisation safe hai.
                </p>
              </section>
            </div>
          )}

          {tab === "export" && (
            <section className="glass animate-rise space-y-5 rounded-3xl p-5">
              <div>
                <h3 className="text-sm font-bold">🚀 Render &amp; export</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                  Render job chalao, phir ready-made yt-dlp + ffmpeg script
                  download karo — wahi script exact ye preview 1080×1920 file me
                  convert kar deti hai.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void startRender()}
                  className="btn-glow hover:btn-glow-hover rounded-full px-4 py-2 text-[12px] font-bold text-white"
                >
                  {status === "ready" ? "🔁 Re-render" : "▶ Start render"}
                </button>
                {projectId && (
                  <>
                    <a
                      href={`/api/projects/${projectId}/script?format=sh`}
                      className="rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-[11px] font-semibold text-white/80 transition hover:bg-white/10"
                    >
                      ⬇ render.sh
                    </a>
                    <a
                      href={`/api/projects/${projectId}/script?format=json`}
                      className="rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-[11px] font-semibold text-white/80 transition hover:bg-white/10"
                    >
                      ⬇ recipe.json
                    </a>
                    <button
                      type="button"
                      onClick={() => void copyScript()}
                      className="rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-[11px] font-semibold text-white/80 transition hover:bg-white/10"
                    >
                      📋 Copy script
                    </button>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[11px] font-semibold text-white/60">
                  <span>Render progress</span>
                  <span>
                    {status === "ready"
                      ? `done · ${fmtBytes(outputBytes)}`
                      : `${progress}%`}
                  </span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300 transition-[width] duration-500 ${
                      status === "rendering" ? "shimmer" : ""
                    }`}
                    style={{ width: `${status === "ready" ? 100 : progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Clip", `${clipDur.toFixed(1)}s`],
                  ["Resolution", "1080×1920"],
                  ["Music", selectedTrack ? selectedTrack.title : "none"],
                  ["Captions", captionStyle],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-white/40">
                      {k}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] font-bold">{v}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold text-white/60">
                  Render script preview
                </p>
                <pre className="max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/60 p-4 text-[10.5px] leading-relaxed text-cyan-100/80">
                  {script || "Pehle short save karo — script yahan generate hogi."}
                </pre>
              </div>
            </section>
          )}

          {tab === "publish" && (
            <div className="animate-rise">
              {projectId ? (
                <PublishPanel
                  project={{
                    id: projectId,
                    videoId: video.id,
                    trackId,
                    title,
                    hookText,
                    startSec,
                    endSec,
                    layout,
                    captionStyle,
                    musicVolume,
                    duckVolume,
                    status,
                    renderProgress: progress,
                    outputBytes,
                    updatedAt: new Date().toISOString(),
                  }}
                  sourceTitle={video.title}
                  channel={video.author}
                  mood={selectedTrack?.mood ?? "no-music"}
                  trackTitle={selectedTrack?.title ?? null}
                />
              ) : (
                <section className="glass rounded-3xl p-8 text-center">
                  <p className="text-3xl">📤</p>
                  <p className="mt-3 text-sm font-bold">
                    Pehle short save karo, phir auto-publish
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-white/45">
                    Save karne ke baad app khud title + description likhega aur ek
                    permission lekar YouTube par upload kar dega.
                  </p>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={busy === "save"}
                    className="btn-glow hover:btn-glow-hover mt-5 rounded-full px-5 py-2.5 text-[12px] font-bold text-white disabled:opacity-50"
                  >
                    {busy === "save" ? "Saving…" : "💾 Save & continue"}
                  </button>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="glass rounded-3xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">
            📦 Is video ke Shorts ({shorts.length})
          </h3>
          <Link
            href="/projects"
            className="text-[11px] font-semibold text-cyan-300/80 hover:text-cyan-200"
          >
            saare shorts dekho →
          </Link>
        </div>
        {shorts.length === 0 ? (
          <p className="text-[12px] text-white/40">
            Abhi koi short nahi bana. Trim karo aur “Save” ya “Generate series”
            dabao.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shorts.map((short) => (
              <div
                key={short.id}
                className={`group relative overflow-hidden rounded-2xl border p-3 transition ${
                  projectId === short.id
                    ? "border-fuchsia-400/60 bg-fuchsia-400/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => loadShort(short)}
                  className="block w-full text-left"
                >
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold text-white/55">
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5">
                      {fmtTime(short.startSec)}–{fmtTime(short.endSec)}
                    </span>
                    <span
                      className={
                        short.status === "ready"
                          ? "text-emerald-300"
                          : short.status === "rendering"
                            ? "text-amber-300"
                            : ""
                      }
                    >
                      {STATUS_LABEL[short.status] ?? short.status}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[12.5px] font-bold leading-snug">
                    {short.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[10.5px] text-white/40">
                    {short.hookText || "no hook text"}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => void removeShort(short.id)}
                  className="absolute right-2 top-2 rounded-lg bg-black/60 px-1.5 py-0.5 text-[10px] text-white/50 opacity-0 transition group-hover:opacity-100 hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
