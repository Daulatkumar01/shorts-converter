/**
 * ShortsLab auto copywriter.
 *
 * Writes the upload metadata (title / description / tags / hashtags) for a
 * short without any external API. It works from signals we already have: the
 * source video title, the hook text, the clip range, the music mood and the
 * chosen layout. Output is deterministic per seed, so "regenerate" gives a new
 * stable variant instead of random noise.
 */

export type MetaInput = {
  seed: number;
  sourceTitle: string;
  channel: string;
  hookText: string;
  startSec: number;
  endSec: number;
  mood: string;
  trackTitle: string | null;
  layout: string;
};

export type GeneratedMeta = {
  flavour: string;
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
};

export const FLAVOURS = [
  { key: "hook", label: "🎯 Hook", desc: "Direct, scroll-stopping" },
  { key: "curiosity", label: "🤔 Curiosity", desc: "Gap jo click karwata hai" },
  { key: "listicle", label: "🔢 Listicle", desc: "Number-driven" },
  { key: "emotional", label: "💫 Emotional", desc: "Feel wala" },
  { key: "bold", label: "⚡ Bold claim", desc: "Contrarian" },
  { key: "minimal", label: "🧊 Minimal", desc: "Clean aesthetic" },
] as const;

const HINGLISH_MARKERS = new Set([
  "hai",
  "nahi",
  "nhi",
  "kya",
  "karo",
  "kar",
  "kaise",
  "kyun",
  "aap",
  "tum",
  "ye",
  "yeh",
  "aur",
  "bhi",
  "mein",
  "me",
  "se",
  "ka",
  "ki",
  "ke",
  "ko",
  "sab",
  "log",
  "baat",
  "badla",
  "badal",
  "duniya",
  "koi",
  "ek",
  "bana",
  "chahiye",
  "dega",
  "hoga",
  "sach",
  "zindagi",
]);

function isHinglish(text: string): boolean {
  const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (!words.length) return false;
  const hits = words.filter((w) => HINGLISH_MARKERS.has(w)).length;
  return hits / words.length >= 0.12;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
}

function rng(seed: number) {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length) % arr.length];
}

/** Pull the most "quotable" fragment out of a long source title. */
function keyPhrase(sourceTitle: string): string {
  const cleaned = sourceTitle
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[|•—–·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean);
  const keep = words
    .filter(
      (w) =>
        !/^(the|a|an|official|full|video|hd|4k|60fps|episode|part|ep|new|best|top)$/i.test(
          w,
        ),
    )
    .slice(0, 7);
  return (keep.length ? keep : words.slice(0, 6)).join(" ").trim() || "this clip";
}

function tidyHook(hookText: string): string {
  const t = hookText.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const stripped = t.replace(/[.!?…]+$/, "");
  return stripped.length > 78 ? `${stripped.slice(0, 75).trim()}…` : stripped;
}

const TITLE_CASES: Record<string, string[]> = {
  hook: [
    "{HOOK}",
    "{HOOK} 🤯",
    "{HOOK} (watch till end)",
    "{HOOK} — {PHRASE}",
  ],
  curiosity: [
    "Nobody tells you this about {PHRASE} 👀",
    "Wait for it… {HOOK}",
    "This changed how I see {PHRASE} 🔥",
    "You won't believe what happens at {TIME} 😳",
    "The part everyone skips in {PHRASE}",
  ],
  listicle: [
    "{N} things about {PHRASE} you should know",
    "{N} second crash course: {PHRASE} 📚",
    "Top {N} takeaways from {PHRASE}",
    "{N} rules from {PHRASE} ⚡",
  ],
  emotional: [
    "{HOOK} 💛",
    "This hit different — {PHRASE}",
    "If you're feeling stuck, watch {HOOK}",
    "{PHRASE} in {N} seconds of calm ✨",
  ],
  bold: [
    "Everyone is wrong about {PHRASE}",
    "Stop doing this with {PHRASE} 🚫",
    "{PHRASE}? Here's the truth.",
    "Unpopular opinion: {HOOK}",
  ],
  minimal: ["{PHRASE}", "{PHRASE} — {N}s", "{HOOK}", "{N} seconds of {PHRASE}"],
};

const HINGLISH_TITLES: Record<string, string[]> = {
  hook: ["{HOOK} 🤯", "{HOOK} — end tak dekho", "{HOOK} 🔥"],
  curiosity: [
    "{PHRASE} ke baare me ye kisi nahi bataya 👀",
    "Ruko… {HOOK}",
    "Ye {TIME} par hota hai 😳",
  ],
  listicle: [
    "{PHRASE} ke {N} baatein jo kaam aayengi",
    "{N} second me {PHRASE} samjho 📚",
  ],
  emotional: ["{HOOK} 💛", "{PHRASE} — {N} second ka sukoon ✨"],
  bold: ["{PHRASE} me sab ye galat karte hain 🚫", "Sach ye hai: {HOOK}"],
  minimal: ["{PHRASE}", "{HOOK}", "{N} second · {PHRASE}"],
};

const CTA_EN = [
  "Follow for part {NEXT} 👉",
  "Save this before it disappears 🔖",
  "Comment your take 👇",
  "Full video on the channel 🎬",
];
const CTA_HI = [
  "Part {NEXT} ke liye follow karo 👉",
  "Save kar lo, baad me kaam aayega 🔖",
  "Comment me batao 👇",
  "Poora video channel par hai 🎬",
];

const HASHTAG_POOL_EN = [
  "shorts",
  "shortsfeed",
  "viral",
  "fyp",
  "foryou",
  "reels",
  "mustwatch",
  "learnontiktok",
  "mindset",
  "motivation",
];
const HASHTAG_POOL_HI = [
  "shorts",
  "viralshorts",
  "hindishorts",
  "desishorts",
  "knowledge",
  "facts",
  "motivation",
  "trending",
];

function titleCaseWords(text: string): string {
  return text
    .split(" ")
    .map((w) =>
      w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w.toLowerCase(),
    )
    .join(" ");
}

export function generateMeta(
  input: MetaInput,
  flavour = "hook",
  salt = 0,
): GeneratedMeta {
  const r = rng(input.seed + salt * 7919 + flavour.length * 131);
  const hinglish =
    isHinglish(input.hookText) || isHinglish(input.sourceTitle);

  const phrase = keyPhrase(input.sourceTitle);
  const hook = tidyHook(input.hookText) || titleCaseWords(phrase);
  const seconds = Math.max(1, Math.round(input.endSec - input.startSec));

  const bank = hinglish
    ? (HINGLISH_TITLES[flavour] ?? HINGLISH_TITLES.hook)
    : (TITLE_CASES[flavour] ?? TITLE_CASES.hook);

  const fill = (template: string) =>
    template
      .replace("{HOOK}", hook)
      .replace("{PHRASE}", titleCaseWords(phrase))
      .replace("{N}", String(seconds))
      .replace("{TIME}", `${Math.round(input.startSec)}s`)
      .replace("{NEXT}", String(2 + Math.floor(r() * 4)));

  let title = fill(pick(bank, r));
  if (title.length > 96) title = `${title.slice(0, 93).trim()}…`;
  if (!/shorts/i.test(title) && r() > 0.45) {
    title = hinglish ? `${title} #shorts` : `${title} #shorts`;
  }

  const ctaBank = hinglish ? CTA_HI : CTA_EN;
  const tagPool = hinglish ? HASHTAG_POOL_HI : HASHTAG_POOL_EN;

  const subject = slug(phrase) || "shorts";
  const stamp = `${Math.floor(input.startSec / 60)}:${String(Math.round(input.startSec % 60)).padStart(2, "0")}`;

  const descLines = [
    hook ? `${hook}${/[.!?…]$/.test(hook) ? "" : "."}` : "",
    "",
    hinglish
      ? `Ye ${seconds} second ka clip is video se liya gaya hai — "${input.sourceTitle}" (${input.channel}).`
      : `A ${seconds}-second cut from "${input.sourceTitle}" by ${input.channel}.`,
    `⏱️ Clip timestamp: ${stamp}`,
    "",
    `🎧 Background music: ${input.trackTitle ?? "original audio"} (${input.mood}) — generated in-browser, 100% copyright-free.`,
    `🎬 Framing: ${input.layout} · 1080×1920`,
    "",
    pick(ctaBank, r),
  ];

  const hashtags = Array.from(
    new Set([subject, ...Array.from({ length: 4 }, () => pick(tagPool, r))]),
  )
    .filter(Boolean)
    .slice(0, 5)
    .map((h) => `#${slug(h)}`)
    .filter((h) => h.length > 2);

  const baseTags = [
    "shorts",
    "youtube shorts",
    "short video",
    phrase.toLowerCase().slice(0, 40),
    input.mood,
    input.layout,
    hinglish ? "hindi shorts" : "quick tips",
    input.channel.toLowerCase().slice(0, 24),
  ]
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);

  return {
    flavour,
    title: title.slice(0, 100),
    description: descLines.filter((l, i) => l !== "" || i < 3).join("\n"),
    tags: baseTags,
    hashtags,
  };
}

export function generateAllFlavours(
  input: MetaInput,
  salt = 0,
): GeneratedMeta[] {
  return FLAVOURS.map((f) => generateMeta(input, f.key, salt));
}

export function crossPostCaptions(meta: GeneratedMeta) {
  const tags = meta.hashtags.join(" ");
  return {
    youtube: `${meta.title}\n\n${meta.description}`,
    instagram: `${meta.title}\n.\n${meta.description
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("🎧") && !l.startsWith("🎬"))
      .join("\n")}\n.\n${tags}`,
    tiktok: `${meta.title} ${tags}`,
    facebook: `${meta.title}\n\n${meta.description}`,
    x: `${meta.title} ${tags}`.slice(0, 279),
  };
}
