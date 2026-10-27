"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  PUB_STATUS,
  fmtBytes,
  fmtTime,
  type AccountDTO,
  type PublicationDTO,
  type SetupDTO,
} from "@/lib/types";

export type QueueItem = PublicationDTO & {
  projectTitle: string;
  startSec: number;
  endSec: number;
  thumb: string;
  videoId: number;
  channelTitle: string | null;
};

type Props = {
  initialAccounts: AccountDTO[];
  setup: SetupDTO;
  initialQueue: QueueItem[];
  videoOptions: { id: number; title: string; count: number }[];
  flash?: string | null;
};

type Busy = null | "auto";

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PublishDashboard({
  initialAccounts,
  setup,
  initialQueue,
  videoOptions,
  flash,
}: Props) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [queue, setQueue] = useState(initialQueue);
  const [privacy, setPrivacy] = useState("public");
  const [gap, setGap] = useState(180);
  const [count, setCount] = useState(5);
  const [startAt, setStartAt] = useState(() =>
    toLocalInput(new Date(Date.now() + 30 * 60 * 1000)),
  );
  const [busy, setBusy] = useState<Busy>(null);
  const [toast, setToast] = useState<string | null>(flash ?? null);
  const [filter, setFilter] = useState("all");

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const refresh = useCallback(async () => {
    const [accRes, qRes] = await Promise.all([
      fetch("/api/accounts", { cache: "no-store" }),
      fetch("/api/publish", { cache: "no-store" }),
    ]);
    const acc = (await accRes.json()) as { accounts: AccountDTO[] };
    const q = (await qRes.json()) as { publications: PublicationDTO[] };
    setAccounts(acc.accounts ?? []);
    const byId = new Map(initialQueue.map((i) => [i.id, i]));
    setQueue(
      (q.publications ?? []).map((p) => {
        const known = byId.get(p.id);
        return known ? { ...p, ...known, ...p } : (p as QueueItem);
      }),
    );
  }, [initialQueue]);

  useEffect(() => {
    const uploading = queue.some((q) => q.status === "uploading");
    if (!uploading) return;
    const id = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(id);
  }, [queue, refresh]);

  const autopilot = async () => {
    const target = videoOptions[0];
    if (!target) {
      say("Pehle koi video ke shorts banao.");
      return;
    }
    if (!accounts.length) {
      say("Pehle YouTube channel connect karo.");
      return;
    }
    setBusy("auto");
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          autopilot: true,
          videoId: target.id,
          accountId: accounts[0].id,
          count,
          gapMinutes: gap,
          privacy,
        }),
      });
      const data = (await res.json()) as {
        publications?: PublicationDTO[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Autopilot fail");
      await refresh();
      say(`${data.publications?.length ?? 0} shorts queue me daal diye 🗓️`);
    } catch (err) {
      say(err instanceof Error ? err.message : "Autopilot fail");
    } finally {
      setBusy(null);
    }
  };

  const removeItem = async (id: number) => {
    await fetch(`/api/publications/${id}`, { method: "DELETE" });
    setQueue((q) => q.filter((i) => i.id !== id));
  };

  const account = accounts[0] ?? null;
  const visible =
    filter === "all" ? queue : queue.filter((q) => q.status === filter);
  const stats = {
    live: queue.filter((q) => q.status === "published").length,
    queued: queue.filter((q) => q.status === "queued").length,
    failed: queue.filter((q) => q.status === "failed").length,
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="animate-rise rounded-2xl border border-white/15 bg-[#12101c]/95 px-4 py-2.5 text-[12px] font-semibold text-white">
          {toast}
        </div>
      )}

      <header className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            Auto <span className="grad-text">Publish</span>
          </h1>
          <p className="mt-1 text-[12px] text-white/45">
            Ek permission · khud likha metadata · khud upload
          </p>
        </div>
        {account ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2.5">
            {account.channelThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.channelThumb} alt="" className="h-9 w-9 rounded-full" />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-400/20">✓</span>
            )}
            <div>
              <p className="text-[13px] font-bold text-emerald-100">
                {account.channelTitle}
              </p>
              <p className="text-[10.5px] text-emerald-300/70">
                scope: youtube.upload only
              </p>
            </div>
          </div>
        ) : (
          <a
            href="/api/auth/youtube/start"
            className={`rounded-full px-5 py-2.5 text-[12px] font-bold ${
              setup.configured
                ? "btn-glow hover:btn-glow-hover text-white"
                : "border border-white/15 bg-white/5 text-white/60"
            }`}
          >
            🔐 Connect YouTube channel
          </a>
        )}
      </header>

      {!setup.configured && (
        <section className="glass rounded-3xl p-5">
          <h2 className="text-sm font-bold text-amber-200">
            ⚙️ Google keys set karo (ek baar, 2 minute)
          </h2>
          <p className="mt-1 text-[11px] text-white/45">
            Poora step-by-step guide (copy-paste commands ke saath){" "}
            <Link
              href="/deploy"
              className="font-semibold text-cyan-300 underline decoration-cyan-400/40"
            >
              /deploy
            </Link>{" "}
            page par hai.
          </p>
          <ol className="mt-3 space-y-2 text-[12px] leading-relaxed text-white/60">
            <li>
              1.{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-cyan-300 underline decoration-cyan-400/40"
              >
                Google Cloud Console
              </a>{" "}
              → <b>Create Credentials → OAuth client ID → Web application</b>
            </li>
            <li>
              2. <b>YouTube Data API v3</b> enable karo.
            </li>
            <li>
              3. Redirect URI me ye daalo (copy kar lo):
              <code className="mt-1 block break-all rounded-lg bg-black/50 px-2 py-1.5 text-[10.5px] text-cyan-200">
                {setup.redirectUri}
              </code>
            </li>
            <li>
              4. Env variables:
              <code className="mt-1 block rounded-lg bg-black/50 px-2 py-1.5 text-[10.5px] text-cyan-200">
                GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
              </code>
            </li>
            <li>
              5. OAuth consent screen → <b>Testing</b> → apna email test user me add
              karo.
            </li>
          </ol>
        </section>
      )}

      {/* Autopilot */}
      <section className="glass rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">🗓️ Autopilot series</h2>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-white/45">
              Ek video ke saare shorts ko queue me daal do — app khud title/description
              likhega aur ek-ek karke schedule karega. Sirf file drop karni baaki
              rahegi.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void autopilot()}
            disabled={busy === "auto" || !videoOptions.length}
            className="btn-glow hover:btn-glow-hover rounded-full px-5 py-2.5 text-[12px] font-bold text-white disabled:opacity-50"
          >
            {busy === "auto" ? "Queue bana raha hai…" : "⚡ Autopilot on karo"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-white/60">
              Source video
            </span>
            <select
              className="w-full rounded-xl border border-white/12 bg-black/50 px-2.5 py-2 text-[12px] outline-none"
              disabled
            >
              {videoOptions.map((v) => (
                <option key={v.id}>
                  {v.title.slice(0, 42)} ({v.count})
                </option>
              ))}
              {!videoOptions.length && <option>koi short nahi bana</option>}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex justify-between text-[11px] font-semibold text-white/60">
              Kitne shorts <span>{count}</span>
            </span>
            <input
              type="range"
              min={1}
              max={15}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex justify-between text-[11px] font-semibold text-white/60">
              Gap (minutes) <span>{gap}</span>
            </span>
            <input
              type="range"
              min={15}
              max={720}
              step={15}
              value={gap}
              onChange={(e) => setGap(Number(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-white/60">
              Visibility
            </span>
            <select
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value)}
              className="w-full rounded-xl border border-white/12 bg-black/50 px-2.5 py-2 text-[12px] outline-none"
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </label>
        </div>
        <p className="mt-3 text-[10.5px] text-white/35">
          Start: {new Date(startAt).toLocaleString()} · next{" "}
          {new Date(Date.now() + gap * 60000).toLocaleTimeString()}
        </p>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Live", stats.live, "text-emerald-300"],
          ["Queued", stats.queued, "text-amber-300"],
          ["Failed", stats.failed, "text-red-300"],
          ["Channels", accounts.length, "text-cyan-300"],
        ].map(([label, value, cls]) => (
          <div key={String(label)} className="glass rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wide text-white/40">
              {label}
            </p>
            <p className={`mt-1 text-2xl font-black ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Queue */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">📤 Publish queue ({queue.length})</h2>
          <div className="flex flex-wrap gap-1.5">
            {["all", "queued", "published", "failed"].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize transition ${
                  filter === f
                    ? "bg-white/90 text-black"
                    : "border border-white/12 bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center">
            <p className="text-3xl">🗓️</p>
            <p className="mt-3 text-sm font-bold">Queue khali hai</p>
            <p className="mx-auto mt-1 max-w-sm text-[12px] text-white/45">
              Studio ke Publish tab se ek short add karo, ya Autopilot on karke poori
              series schedule kar do.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[12px] font-semibold transition hover:bg-white/10"
            >
              Studio kholo →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((q) => (
              <div key={q.id} className="glass overflow-hidden rounded-3xl">
                <div className="relative h-28 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={q.thumb}
                    alt=""
                    className="h-full w-full object-cover opacity-70"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07060d] to-transparent" />
                  <span
                    className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      q.status === "published"
                        ? "bg-emerald-400/25 text-emerald-200"
                        : q.status === "uploading"
                          ? "bg-amber-400/25 text-amber-200"
                          : q.status === "failed"
                            ? "bg-red-400/25 text-red-200"
                            : "bg-white/15 text-white/70"
                    }`}
                  >
                    {PUB_STATUS[q.status] ?? q.status}
                  </span>
                </div>
                <div className="space-y-2 p-4">
                  <p className="line-clamp-2 text-[12.5px] font-bold leading-snug">
                    {q.title}
                  </p>
                  <p className="truncate text-[10.5px] text-white/40">
                    {fmtTime(q.startSec)}–{fmtTime(q.endSec)} · {q.privacy}
                    {q.uploadBytes ? ` · ${fmtBytes(q.uploadBytes)}` : ""}
                  </p>
                  {q.publishAt && (
                    <p className="text-[10.5px] text-amber-200/70">
                      ⏰ {new Date(q.publishAt).toLocaleString()}
                    </p>
                  )}
                  {q.status === "uploading" && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-amber-300"
                        style={{ width: `${q.progress}%` }}
                      />
                    </div>
                  )}
                  {q.errorMessage && (
                    <p className="rounded-lg border border-red-400/20 bg-red-400/5 p-2 text-[10px] leading-relaxed text-red-200/80">
                      {q.errorMessage}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    {q.youtubeUrl ? (
                      <a
                        href={q.youtubeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 rounded-xl bg-emerald-400/15 px-3 py-2 text-center text-[11px] font-bold text-emerald-200"
                      >
                        ▶ Watch
                      </a>
                    ) : (
                      <Link
                        href={`/studio/${q.videoId}?p=${q.projectId}`}
                        className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-center text-[11px] font-bold transition hover:bg-white/20"
                      >
                        Upload karo →
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => void removeItem(q.id)}
                      className="rounded-xl border border-white/12 px-3 py-2 text-[11px] text-white/50 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
