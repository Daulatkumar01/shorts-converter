"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { crossPostCaptions } from "@/lib/metadata-gen";
import {
  PUB_STATUS,
  fmtBytes,
  type AccountDTO,
  type ProjectDTO,
  type PublicationDTO,
  type SetupDTO,
  type VariantDTO,
} from "@/lib/types";

type Props = {
  project: ProjectDTO;
  sourceTitle: string;
  channel: string;
  mood: string;
  trackTitle: string | null;
};

type Busy = null | "meta" | "queue" | "upload" | "auto";

const FLAVOUR_LABEL: Record<string, string> = {
  hook: "🎯 Hook",
  curiosity: "🤔 Curiosity",
  listicle: "🔢 Listicle",
  emotional: "💫 Emotional",
  bold: "⚡ Bold claim",
  minimal: "🧊 Minimal",
};

const MAX_BYTES = 256 * 1024 * 1024;

function toLocalInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 30 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PublishPanel({
  project,
  sourceTitle,
  channel,
  mood,
  trackTitle,
}: Props) {
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [setup, setSetup] = useState<SetupDTO | null>(null);
  const [variants, setVariants] = useState<VariantDTO[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [salt, setSalt] = useState(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  const [privacy, setPrivacy] = useState("public");
  const [madeForKids, setMadeForKids] = useState(false);
  const [schedule, setSchedule] = useState(false);
  const [publishAt, setPublishAt] = useState(() => toLocalInput(null));

  const [queue, setQueue] = useState<PublicationDTO[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pct, setPct] = useState(0);
  const [stage, setStage] = useState<string>("");
  const [busy, setBusy] = useState<Busy>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const active = variants.find((v) => v.id === activeId) ?? null;
  const account = accounts[0] ?? null;

  const say = useCallback((kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  /* ---------------- data loading ---------------- */

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts", { cache: "no-store" });
      const data = (await res.json()) as {
        accounts: AccountDTO[];
        setup: SetupDTO;
      };
      setAccounts(data.accounts ?? []);
      setSetup(data.setup ?? null);
    } catch {
      /* ignore */
    }
  }, []);

  const loadVariants = useCallback(async () => {
    try {
      const res = await fetch(`/api/metadata?projectId=${project.id}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { variants: VariantDTO[] };
      setVariants(data.variants ?? []);
      const chosen = data.variants?.find((v) => v.chosen) ?? data.variants?.[0];
      if (chosen) {
        setActiveId(chosen.id);
        setTitle(chosen.title);
        setDescription(chosen.description);
        setTags(chosen.tags);
      }
      return data.variants ?? [];
    } catch {
      return [];
    }
  }, [project.id]);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/publish?projectId=${project.id}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { publications: PublicationDTO[] };
      setQueue(data.publications ?? []);
    } catch {
      /* ignore */
    }
  }, [project.id]);

  useEffect(() => {
    void loadAccounts();
    void loadQueue();
    void (async () => {
      const existing = await loadVariants();
      if (!existing.length) void generate(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Poll the queue while something is uploading.
  useEffect(() => {
    const uploading = queue.some((q) => q.status === "uploading");
    if (!uploading) return;
    const id = window.setInterval(() => void loadQueue(), 2500);
    return () => window.clearInterval(id);
  }, [queue, loadQueue]);

  /* ---------------- actions ---------------- */

  const generate = async (silent = false) => {
    if (!silent) setBusy("meta");
    try {
      const res = await fetch("/api/metadata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, salt }),
      });
      const data = (await res.json()) as { variants?: VariantDTO[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Generate fail");
      setVariants(data.variants ?? []);
      const chosen = data.variants?.find((v) => v.chosen) ?? data.variants?.[0];
      if (chosen) {
        setActiveId(chosen.id);
        setTitle(chosen.title);
        setDescription(chosen.description);
        setTags(chosen.tags);
      }
      setSalt((s) => s + 1);
      if (!silent) say("ok", "Naya title + description likh diya ✍️");
    } catch (err) {
      say("err", err instanceof Error ? err.message : "Generate fail");
    } finally {
      setBusy(null);
    }
  };

  const pickVariant = async (variant: VariantDTO) => {
    setActiveId(variant.id);
    setTitle(variant.title);
    setDescription(variant.description);
    setTags(variant.tags);
    await fetch("/api/metadata", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, chooseId: variant.id }),
    }).catch(() => undefined);
  };

  const saveEdits = async () => {
    if (!active) return;
    await fetch("/api/metadata", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: active.id,
        title,
        description,
        tags,
        hashtags: active.hashtags,
      }),
    }).catch(() => undefined);
  };

  const queuePublication = async (): Promise<PublicationDTO | null> => {
    await saveEdits();
    setBusy("queue");
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          accountId: account?.id ?? null,
          variantId: active?.id ?? null,
          titleOverride: title,
          descriptionOverride: description,
          privacy,
          madeForKids,
          publishAt: schedule ? new Date(publishAt).toISOString() : null,
        }),
      });
      const data = (await res.json()) as {
        publication?: PublicationDTO;
        error?: string;
      };
      if (!res.ok || !data.publication) {
        throw new Error(data.error || "Queue fail");
      }
      await loadQueue();
      return data.publication;
    } catch (err) {
      say("err", err instanceof Error ? err.message : "Queue fail");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const acceptFile = (f: File | null) => {
    if (!f) return;
    if (!/\.(mp4|mov|m4v|webm)$/i.test(f.name)) {
      say("err", "Sirf video file (mp4 / mov / webm) chalegi.");
      return;
    }
    if (f.size > MAX_BYTES) {
      say("err", `File ${(f.size / 1048576).toFixed(0)} MB hai — 256 MB se kam rakho.`);
      return;
    }
    setFile(f);
    setPct(0);
  };

  const upload = async () => {
    if (!file) {
      say("err", "Pehle rendered MP4 choose karo.");
      return;
    }
    if (!account) {
      say("err", "Pehle YouTube channel connect karo (ek permission chahiye).");
      return;
    }
    if (title.trim().length < 3) {
      say("err", "Title khali hai — 'Auto-write' dabao ya khud likho.");
      return;
    }

    let pub = queue.find((q) => q.status !== "published") ?? null;
    if (!pub || pub.title !== title || pub.privacy !== privacy) {
      const created = await queuePublication();
      if (!created) return;
      pub = created;
    }

    setBusy("upload");
    setPct(0);
    setStage("Upload session ban raha hai…");

    try {
      const sessionRes = await fetch(`/api/publications/${pub.id}/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileSize: file.size }),
      });
      const session = (await sessionRes.json()) as {
        sessionUri?: string;
        error?: string;
      };
      if (!sessionRes.ok || !session.sessionUri) {
        throw new Error(session.error || "Session fail");
      }

      setStage("Video Google par ja raha hai…");
      const videoId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", session.sessionUri!, true);
        xhr.setRequestHeader("content-type", "video/mp4");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setPct(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) {
            try {
              const parsed = JSON.parse(xhr.responseText) as { id?: string };
              if (parsed.id) resolve(parsed.id);
              else reject(new Error("Google ne video id nahi bheja."));
            } catch {
              reject(new Error(`Response parse fail (${xhr.status}).`));
            }
          } else {
            reject(
              new Error(
                `Upload fail (${xhr.status}): ${xhr.responseText.slice(0, 300)}`,
              ),
            );
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.onabort = () => reject(new Error("Upload cancel kar diya."));
        xhr.send(file);
      });

      setStage("Finalising…");
      const finishRes = await fetch(`/api/publications/${pub.id}/finish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId, bytes: file.size }),
      });
      const finished = (await finishRes.json()) as {
        publication?: PublicationDTO;
        error?: string;
      };
      if (!finishRes.ok || !finished.publication) {
        throw new Error(finished.error || "Finish fail");
      }
      setPct(100);
      setStage("Published 🎉");
      await loadQueue();
      say("ok", "Upload ho gaya! Short live hai 🚀");
    } catch (err) {
      say("err", err instanceof Error ? err.message : "Upload fail");
      setStage("");
      await loadQueue();
    } finally {
      setBusy(null);
      xhrRef.current = null;
    }
  };

  const cancelUpload = () => {
    xhrRef.current?.abort();
    setBusy(null);
  };

  const copyCrossPost = async (platform: keyof ReturnType<typeof crossPostCaptions>) => {
    const caption = crossPostCaptions({
      flavour: "hook",
      title,
      description,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      hashtags: (active?.hashtags ?? "").split(/\s+/).filter(Boolean),
    });
    try {
      await navigator.clipboard.writeText(caption[platform]);
      say("ok", `${platform} caption copy ho gaya 📋`);
    } catch {
      say("err", "Copy fail");
    }
  };

  const uploading = busy === "upload";
  const live = queue.filter((q) => q.status === "published");

  /* ---------------- render ---------------- */

  return (
    <div className="space-y-5">
      {toast && (
        <div
          className={`animate-rise rounded-2xl border px-4 py-2.5 text-[12px] font-semibold ${
            toast.kind === "ok"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : "border-red-400/30 bg-red-400/10 text-red-200"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* STEP 1 — connect */}
      <section className="glass rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">1 · Channel connect karo</h3>
            <p className="mt-1 max-w-lg text-[11px] leading-relaxed text-white/45">
              Sirf <span className="font-bold text-white/70">ek permission</span>{" "}
              maangenge — <code className="text-cyan-300/80">youtube.upload</code>.
              Na email, na analytics, na kuch aur.
            </p>
          </div>
          {account ? (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2">
              {account.channelThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={account.channelThumb}
                  alt=""
                  className="h-7 w-7 rounded-full"
                />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-400/20 text-[11px]">
                  ✓
                </span>
              )}
              <div className="max-w-[160px]">
                <p className="truncate text-[12px] font-bold text-emerald-100">
                  {account.channelTitle}
                </p>
                <p className="text-[10px] text-emerald-300/70">
                  {account.uploads} uploads
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
                  await loadAccounts();
                }}
                className="ml-1 text-[11px] text-white/40 hover:text-red-300"
              >
                ✕
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/youtube/start"
              className="btn-glow hover:btn-glow-hover rounded-full px-4 py-2 text-[12px] font-bold text-white"
            >
              🔐 Connect YouTube
            </a>
          )}
        </div>

        {!account && setup && !setup.configured && (
          <div className="mt-4 space-y-3 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
            <p className="text-[12px] font-bold text-amber-200">
              ⚙️ Ek baar setup karna hai (2 minute)
            </p>
            <ol className="space-y-1.5 text-[11.5px] leading-relaxed text-amber-100/75">
              <li>
                1.{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline decoration-amber-400/50"
                >
                  Google Cloud Console
                </a>{" "}
                → Create OAuth client → <b>Web application</b>
              </li>
              <li>
                2. Authorised redirect URI me ye exact value daalo:
                <code className="mt-1 block break-all rounded-lg bg-black/50 px-2 py-1.5 text-[10.5px] text-cyan-200">
                  {setup.redirectUri}
                </code>
              </li>
              <li>
                3. <code>YouTube Data API v3</code> enable karo (APIs &amp; Services →
                Library)
              </li>
              <li>
                4. Client ID / Secret ko env me daalo:
                <code className="mt-1 block rounded-lg bg-black/50 px-2 py-1.5 text-[10.5px] text-cyan-200">
                  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
                </code>
              </li>
              <li>
                5. App ko <b>Testing</b> mode me apna Google account test user bana lo
              </li>
            </ol>
            <button
              type="button"
              onClick={() => void loadAccounts()}
              className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold text-amber-100"
            >
              ↻ Re-check keys
            </button>
          </div>
        )}
      </section>

      {/* STEP 2 — auto-written metadata */}
      <section className="glass rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">2 · Title &amp; description auto-likho</h3>
            <p className="mt-1 text-[11px] text-white/45">
              Source title, hook, clip timing aur music mood se khud copy banata hai.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy === "meta"}
            className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2 text-[12px] font-bold text-black/85 disabled:opacity-50"
          >
            {busy === "meta" ? "✍️ Likh raha hai…" : "✨ Auto-write / regenerate"}
          </button>
        </div>

        {variants.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => void pickVariant(v)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                  activeId === v.id
                    ? "bg-white/90 text-black"
                    : "border border-white/12 bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {FLAVOUR_LABEL[v.flavour] ?? v.flavour}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/60">
              Title <span>{title.length}/100</span>
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2 text-sm outline-none focus:border-fuchsia-400/60"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[11px] font-semibold text-white/60">
              Description <span>{description.length}/4900</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              maxLength={4900}
              className="w-full resize-y rounded-xl border border-white/12 bg-black/40 px-3 py-2 font-mono text-[11.5px] leading-relaxed outline-none focus:border-fuchsia-400/60"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-white/60">
              Tags (comma separated)
            </span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2 text-[12px] outline-none focus:border-fuchsia-400/60"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["instagram", "tiktok", "facebook", "x"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => void copyCrossPost(p)}
              className="rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              📋 {p} caption
            </button>
          ))}
        </div>
      </section>

      {/* STEP 3 — upload */}
      <section className="glass rounded-3xl p-5">
        <h3 className="text-sm font-bold">3 · Video daalo aur upload karo</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-white/45">
          Render tab se <code className="text-white/70">render.sh</code> download karke
          MP4 bana lo, phir yahan drop kar do. Upload seedha Google ke resumable
          session par jaata hai — 8 MB chunks, live progress.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              acceptFile(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${
              dragging
                ? "border-fuchsia-400/70 bg-fuchsia-400/10"
                : "border-white/15 bg-white/[0.03] hover:bg-white/[0.06]"
            }`}
          >
            <span className="text-2xl">{file ? "🎞️" : "⬆️"}</span>
            {file ? (
              <>
                <p className="truncate text-[12.5px] font-bold">{file.name}</p>
                <p className="text-[11px] text-white/45">
                  {fmtBytes(file.size)} · click to change
                </p>
              </>
            ) : (
              <>
                <p className="text-[12.5px] font-bold">
                  MP4 yahan drag karo ya click karke choose karo
                </p>
                <p className="text-[11px] text-white/40">
                  1080×1920 recommended · max 256 MB
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-white/60">
                Visibility
              </span>
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value)}
                disabled={schedule}
                className="w-full rounded-xl border border-white/12 bg-black/50 px-2.5 py-2 text-[12px] outline-none focus:border-fuchsia-400/60"
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-[11.5px] text-white/70">
              <input
                type="checkbox"
                checked={madeForKids}
                onChange={(e) => setMadeForKids(e.target.checked)}
                className="h-3.5 w-3.5 accent-fuchsia-500"
              />
              Made for kids
            </label>
            <label className="flex items-center gap-2 text-[11.5px] text-white/70">
              <input
                type="checkbox"
                checked={schedule}
                onChange={(e) => setSchedule(e.target.checked)}
                className="h-3.5 w-3.5 accent-fuchsia-500"
              />
              Schedule karke daalo
            </label>
            {schedule && (
              <input
                type="datetime-local"
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
                className="w-full rounded-xl border border-white/12 bg-black/50 px-2.5 py-2 text-[11.5px] outline-none focus:border-fuchsia-400/60"
              />
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void upload()}
            disabled={uploading || !file}
            className="btn-glow hover:btn-glow-hover rounded-full px-5 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-50"
          >
            {uploading ? "⏳ Uploading…" : "🚀 Khud upload kar do"}
          </button>
          {uploading && (
            <button
              type="button"
              onClick={cancelUpload}
              className="rounded-full border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-[12px] font-bold text-red-200"
            >
              Cancel
            </button>
          )}
          {!file && (
            <button
              type="button"
              onClick={() => void queuePublication()}
              disabled={busy === "queue"}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-[12px] font-bold text-white/80 disabled:opacity-50"
            >
              {busy === "queue" ? "Adding…" : "➕ Queue me daalo (baad me upload)"}
            </button>
          )}
        </div>

        {(uploading || pct > 0) && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-white/60">
              <span>{stage || "Uploading…"}</span>
              <span>{pct}%</span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300 transition-[width] duration-200 ${
                  uploading ? "shimmer" : ""
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* results */}
      {(live.length > 0 || queue.length > 0) && (
        <section className="glass rounded-3xl p-5">
          <h3 className="text-sm font-bold">
            📤 Is short ke uploads ({queue.length})
          </h3>
          <div className="mt-3 space-y-2">
            {queue.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-[12.5px] font-bold">
                    {q.title}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      q.status === "published"
                        ? "bg-emerald-400/20 text-emerald-200"
                        : q.status === "uploading"
                          ? "bg-amber-400/20 text-amber-200"
                          : q.status === "failed"
                            ? "bg-red-400/20 text-red-200"
                            : "bg-white/10 text-white/60"
                    }`}
                  >
                    {PUB_STATUS[q.status] ?? q.status}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10.5px] text-white/45">
                  <span className="rounded-md bg-white/8 px-1.5 py-0.5">
                    {q.privacy}
                  </span>
                  {q.publishAt && (
                    <span className="rounded-md bg-white/8 px-1.5 py-0.5">
                      ⏰ {new Date(q.publishAt).toLocaleString()}
                    </span>
                  )}
                  {q.uploadBytes > 0 && (
                    <span className="rounded-md bg-white/8 px-1.5 py-0.5">
                      {fmtBytes(q.uploadBytes)}
                    </span>
                  )}
                </div>
                {q.status === "uploading" && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-amber-300"
                      style={{ width: `${q.progress}%` }}
                    />
                  </div>
                )}
                {q.youtubeUrl && (
                  <a
                    href={q.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-400/25"
                  >
                    ▶ YouTube par dekho
                  </a>
                )}
                {q.errorMessage && (
                  <p className="mt-2 rounded-lg border border-red-400/20 bg-red-400/5 p-2 text-[10.5px] leading-relaxed text-red-200/80">
                    {q.errorMessage}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="px-2 text-[10.5px] leading-relaxed text-white/35">
        Note: upload ke liye video file chahiye hoti hai — ShortsLab YouTube ka video
        download nahi karta (ToS). Render script se apna MP4 banao, phir ek click me
        upload. Title, description, tags, hashtags, schedule — sab app khud likh aur
        set kar deta hai.
      </p>
    </div>
  );
}
