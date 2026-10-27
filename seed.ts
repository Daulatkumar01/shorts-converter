import { db } from "@/db";
import { tracks } from "@/db/schema";
import { sql } from "drizzle-orm";

type SeedTrack = {
  slug: string;
  title: string;
  mood: string;
  bpm: number;
  durationSec: number;
  seed: number;
  rootHz: number;
  chords: string;
  scale: string;
  drums: string;
  accent: string;
};

const LIBRARY: SeedTrack[] = [
  {
    slug: "midnight-chai",
    title: "Midnight Chai",
    mood: "lofi",
    bpm: 78,
    durationSec: 120,
    seed: 917331,
    rootHz: 110,
    chords: "0,3,7,10;8,12,15,19;5,8,12,15;7,10,14,17",
    scale: "0,3,5,7,10",
    drums: "lofi",
    accent: "#a855f7",
  },
  {
    slug: "neon-rain",
    title: "Neon Rain",
    mood: "synthwave",
    bpm: 92,
    durationSec: 120,
    seed: 284419,
    rootHz: 130.81,
    chords: "0,4,7,11;5,9,12,16;7,11,14,18;2,5,9,12",
    scale: "0,2,4,7,9",
    drums: "soft",
    accent: "#22d3ee",
  },
  {
    slug: "paper-planes",
    title: "Paper Planes",
    mood: "lofi",
    bpm: 74,
    durationSec: 150,
    seed: 551207,
    rootHz: 98,
    chords: "0,3,7,10;3,7,10,14;8,12,15,19;10,14,17,21",
    scale: "0,2,3,5,7,9,10",
    drums: "lofi",
    accent: "#f0abfc",
  },
  {
    slug: "monsoon-strings",
    title: "Monsoon Strings",
    mood: "cinematic",
    bpm: 66,
    durationSec: 180,
    seed: 771002,
    rootHz: 87.31,
    chords: "0,3,7,12;5,8,12,17;8,12,15,20;3,7,10,15",
    scale: "0,2,3,5,7,8,10",
    drums: "soft",
    accent: "#818cf8",
  },
  {
    slug: "turmeric-sky",
    title: "Turmeric Sky",
    mood: "ambient",
    bpm: 58,
    durationSec: 240,
    seed: 338856,
    rootHz: 116.54,
    chords: "0,7,12,19;5,12,17,24;3,10,15,22;0,7,14,19",
    scale: "0,1,5,7,10",
    drums: "none",
    accent: "#fbbf24",
  },
  {
    slug: "cyber-rickshaw",
    title: "Cyber Rickshaw",
    mood: "trap",
    bpm: 140,
    durationSec: 90,
    seed: 664423,
    rootHz: 146.83,
    chords: "0,3,7,10;-2,2,5,9;3,7,10,14;5,8,12,15",
    scale: "0,3,5,7,10",
    drums: "trap",
    accent: "#f472b6",
  },
  {
    slug: "slow-sunset",
    title: "Slow Sunset",
    mood: "lofi",
    bpm: 70,
    durationSec: 150,
    seed: 128934,
    rootHz: 123.47,
    chords: "0,3,7,10;10,14,17,21;5,8,12,15;8,12,15,19",
    scale: "0,2,3,5,7,9,10",
    drums: "lofi",
    accent: "#fb7185",
  },
  {
    slug: "velvet-static",
    title: "Velvet Static",
    mood: "chillhop",
    bpm: 84,
    durationSec: 120,
    seed: 902451,
    rootHz: 110,
    chords: "0,3,7,14;5,8,12,19;3,7,10,17;7,10,14,21",
    scale: "0,2,3,5,7,9,10",
    drums: "lofi",
    accent: "#34d399",
  },
  {
    slug: "kolkata-dawn",
    title: "Kolkata Dawn",
    mood: "ambient",
    bpm: 54,
    durationSec: 240,
    seed: 445120,
    rootHz: 130.81,
    chords: "0,7,12,16;2,9,14,19;5,12,16,21;0,7,12,19",
    scale: "0,2,4,7,9",
    drums: "none",
    accent: "#fcd34d",
  },
  {
    slug: "glass-ceilings",
    title: "Glass Ceilings",
    mood: "cinematic",
    bpm: 96,
    durationSec: 150,
    seed: 710038,
    rootHz: 103.83,
    chords: "0,3,7,12;7,10,14,19;8,12,15,20;10,14,17,22",
    scale: "0,3,5,7,10",
    drums: "soft",
    accent: "#60a5fa",
  },
  {
    slug: "dusty-vinyl",
    title: "Dusty Vinyl",
    mood: "lofi",
    bpm: 82,
    durationSec: 120,
    seed: 590213,
    rootHz: 92.5,
    chords: "0,3,7,10;5,8,12,15;1,5,8,12;3,7,10,14",
    scale: "0,2,3,5,7,8,10",
    drums: "lofi",
    accent: "#d8b4fe",
  },
  {
    slug: "aurora-drift",
    title: "Aurora Drift",
    mood: "dreamy",
    bpm: 88,
    durationSec: 180,
    seed: 366742,
    rootHz: 138.59,
    chords: "0,4,7,12;9,12,16,21;5,9,12,17;7,11,14,19",
    scale: "0,2,4,6,7,9,11",
    drums: "soft",
    accent: "#7dd3fc",
  },
];

let seeding: Promise<void> | null = null;

export function ensureSeeded(): Promise<void> {
  if (!seeding) {
    seeding = (async () => {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tracks);
      if ((row?.count ?? 0) > 0) return;
      await db.insert(tracks).values(LIBRARY).onConflictDoNothing();
    })().catch((err) => {
      seeding = null;
      throw err;
    });
  }
  return seeding;
}
