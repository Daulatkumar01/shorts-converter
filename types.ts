export type TrackDTO = {
  id: number;
  slug: string;
  title: string;
  artist: string;
  mood: string;
  bpm: number;
  durationSec: number;
  seed: number;
  rootHz: number;
  chords: string;
  scale: string;
  drums: string;
  accent: string;
  license: string;
  plays: number;
};

export type VideoDTO = {
  id: number;
  youtubeId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  durationSec: number;
};

export type ProjectDTO = {
  id: number;
  videoId: number;
  trackId: number | null;
  title: string;
  hookText: string;
  startSec: number;
  endSec: number;
  layout: string;
  captionStyle: string;
  musicVolume: number;
  duckVolume: number;
  status: string;
  renderProgress: number;
  outputBytes: number;
  updatedAt: string;
};

export type VariantDTO = {
  id: number;
  projectId: number;
  flavour: string;
  title: string;
  description: string;
  tags: string;
  hashtags: string;
  chosen: number;
  score: number;
};

export type PublicationDTO = {
  id: number;
  projectId: number;
  accountId: number | null;
  platform: string;
  title: string;
  description: string;
  tags: string;
  privacy: string;
  madeForKids: number;
  publishAt: string | null;
  status: string;
  progress: number;
  uploadBytes: number;
  youtubeVideoId: string;
  youtubeUrl: string;
  errorMessage: string;
  attempts: number;
};

export type AccountDTO = {
  id: number;
  provider: string;
  channelId: string;
  channelTitle: string;
  channelThumb: string;
  scope: string;
  uploads: number;
  lastError: string;
  connected: boolean;
};

export type SetupDTO = {
  configured: boolean;
  redirectUri: string;
  scope: string;
};

export const PUB_STATUS: Record<string, string> = {
  queued: "Queued",
  uploading: "Uploading",
  published: "Live 🎉",
  failed: "Failed",
};

export type LayoutKey = "crop" | "blur" | "fit";

export const LAYOUTS: {
  key: LayoutKey;
  label: string;
  hint: string;
  icon: string;
}[] = [
  { key: "blur", label: "Blur BG", hint: "Full frame + blurred sides", icon: "◍" },
  { key: "crop", label: "Zoom Crop", hint: "Center punch-in 9:16", icon: "▣" },
  { key: "fit", label: "Letterbox", hint: "Clean bars, cinematic", icon: "▭" },
];

export type CaptionKey = "bold" | "gradient" | "minimal" | "neon";

export const CAPTION_STYLES: {
  key: CaptionKey;
  label: string;
  className: string;
}[] = [
  {
    key: "bold",
    label: "Bold Pop",
    className:
      "text-white font-black uppercase tracking-tight [text-shadow:0_3px_0_rgba(0,0,0,.65),0_0_28px_rgba(0,0,0,.55)]",
  },
  {
    key: "gradient",
    label: "Gradient",
    className:
      "bg-gradient-to-r from-fuchsia-300 via-violet-200 to-cyan-300 bg-clip-text text-transparent font-black uppercase [drop-shadow:0_3px_6px_rgba(0,0,0,.7)]",
  },
  {
    key: "minimal",
    label: "Minimal",
    className: "text-white/95 font-semibold tracking-wide [text-shadow:0_2px_10px_rgba(0,0,0,.8)]",
  },
  {
    key: "neon",
    label: "Neon",
    className:
      "text-cyan-200 font-black uppercase [text-shadow:0_0_6px_#22d3ee,0_0_22px_#a855f7,0_3px_0_rgba(0,0,0,.5)]",
  },
];

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  rendering: "Rendering",
  ready: "Ready",
};

export function fmtTime(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

export function fmtBytes(bytes: number): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}
