import {
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Royalty-free (generative) music library.
 * Every track here is described by musical DNA that the browser renders live
 * with the Web Audio API -> nothing is sampled, so it can never be copyright
 * claimed by anyone.
 */
export const tracks = pgTable("tracks", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  artist: text("artist").notNull().default("ShortsLab Engine"),
  mood: text("mood").notNull(),
  bpm: integer("bpm").notNull(),
  durationSec: integer("duration_sec").notNull().default(120),
  seed: integer("seed").notNull(),
  rootHz: real("root_hz").notNull(),
  chords: text("chords").notNull(),
  scale: text("scale").notNull(),
  drums: text("drums").notNull().default("lofi"),
  accent: text("accent").notNull().default("#a855f7"),
  license: text("license")
    .notNull()
    .default("Generative / CC0 - safe for YouTube, Shorts & Reels"),
  plays: integer("plays").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** A source (long) YouTube video. */
export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  youtubeId: text("youtube_id").notNull().unique(),
  title: text("title").notNull(),
  author: text("author").notNull().default("Unknown channel"),
  thumbnailUrl: text("thumbnail_url").notNull().default(""),
  durationSec: integer("duration_sec").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** A Shorts project = one vertical cut of a source video + music + captions. */
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  trackId: integer("track_id").references(() => tracks.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull().default("Untitled Short"),
  hookText: text("hook_text").notNull().default(""),
  startSec: real("start_sec").notNull().default(0),
  endSec: real("end_sec").notNull().default(30),
  layout: text("layout").notNull().default("blur"),
  captionStyle: text("caption_style").notNull().default("bold"),
  musicVolume: integer("music_volume").notNull().default(35),
  duckVolume: integer("duck_volume").notNull().default(60),
  status: text("status").notNull().default("draft"),
  renderProgress: integer("render_progress").notNull().default(0),
  renderStartedAt: timestamp("render_started_at", { withTimezone: true }),
  outputBytes: integer("output_bytes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * A connected social account. The whole app asks for exactly ONE permission:
 * `https://www.googleapis.com/auth/youtube.upload` — nothing else, so the
 * consent screen shows a single line and we can never read email, analytics or
 * anything private.
 */
export const socialAccounts = pgTable("social_accounts", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("youtube"),
  channelId: text("channel_id").notNull().default(""),
  channelTitle: text("channel_title").notNull().default("Connected channel"),
  channelThumb: text("channel_thumb").notNull().default(""),
  scope: text("scope").notNull().default(""),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull().default(""),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  lastError: text("last_error").notNull().default(""),
  uploads: integer("uploads").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Auto-written metadata variants for a short (the "AI copywriter"). */
export const captionVariants = pgTable("caption_variants", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  flavour: text("flavour").notNull().default("hook"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  tags: text("tags").notNull().default(""),
  hashtags: text("hashtags").notNull().default(""),
  chosen: integer("chosen").notNull().default(0),
  score: integer("score").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** One upload job in the publishing pipeline. */
export const publications = pgTable("publications", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  accountId: integer("account_id").references(() => socialAccounts.id, {
    onDelete: "set null",
  }),
  platform: text("platform").notNull().default("youtube"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  tags: text("tags").notNull().default(""),
  privacy: text("privacy").notNull().default("public"),
  madeForKids: integer("made_for_kids").notNull().default(0),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  uploadBytes: integer("upload_bytes").notNull().default(0),
  youtubeVideoId: text("youtube_video_id").notNull().default(""),
  youtubeUrl: text("youtube_url").notNull().default(""),
  errorMessage: text("error_message").notNull().default(""),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type TrackRow = typeof tracks.$inferSelect;
export type VideoRow = typeof videos.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type AccountRow = typeof socialAccounts.$inferSelect;
export type PublicationRow = typeof publications.$inferSelect;
export type CaptionVariantRow = typeof captionVariants.$inferSelect;
