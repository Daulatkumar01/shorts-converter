import type { ProjectDTO, TrackDTO, VideoDTO } from "./types";

function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\u2019")
    .replace(/%/g, "\\%");
}

function wrap(text: string, perLine = 24): string {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > perLine) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur = `${cur} ${w}`;
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 3).join("\n") || "HOOK TEXT";
}

/**
 * Builds a fully working yt-dlp + ffmpeg shell script that reproduces exactly
 * what the studio preview shows: 9:16 framing, blurred background option, hook
 * captions and the copyright-free music bed mixed under the original audio.
 */
export function buildRenderScript(
  project: ProjectDTO,
  video: VideoDTO,
  track: TrackDTO | null,
): string {
  const start = project.startSec.toFixed(2);
  const dur = Math.max(1, project.endSec - project.startSec).toFixed(2);
  const url = `https://www.youtube.com/watch?v=${video.youtubeId}`;
  const slug = (project.title || "short")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const out = `${slug || "short"}-${project.id}.mp4`;
  const musicVol = (project.musicVolume / 100).toFixed(2);
  const voiceVol = (project.duckVolume / 100).toFixed(2);

  let base: string;
  if (project.layout === "crop") {
    base =
      "[0:v]crop=ih*9/16:ih,scale=1080:1920:flags=lanczos,setsar=1";
  } else if (project.layout === "blur") {
    base =
      "[0:v]split=2[bg][fg];" +
      "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=28,eq=brightness=-0.06[bgb];" +
      "[fg]scale=1080:-2[fgs];" +
      "[bgb][fgs]overlay=(W-w)/2:(H-h)/2,setsar=1";
  } else {
    base =
      "[0:v]scale=1080:-2,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black@0.85,setsar=1";
  }

  const caption =
    project.hookText.trim().length > 0
      ? `,drawtext=text='${esc(wrap(project.hookText))}':fontfile=$FONT:fontsize=78:fontcolor=white:borderw=5:bordercolor=black@0.85:line_spacing=18:x=(w-text_w)/2:y=h-430`
      : "";

  const filter = `${base}${caption};[v]format=yuv420p[vout]`;

  const musicBlock = track
    ? `# 3. Copyright-free music bed: "${track.title}" (${track.mood}, ${track.bpm} BPM)
#    Studio ke Music tab se "Download music stem" dabao -> ${track.slug}.wav
#    Us file ko is script ke same folder me rakho.
MUSIC="${track.slug}.wav"
test -f "$MUSIC" || { echo "❌ $MUSIC missing — studio se stem download karo"; exit 1; }

# 4. Mix original voice + music bed, then mux to an upload-ready file
ffmpeg -y -i cut.mp4 -i "$MUSIC" \\
  -filter_complex "[0:a]volume=${voiceVol}[a0];[1:a]volume=${musicVol},afade=t=in:st=0:d=1.2,afade=t=out:st=${(Math.max(1, project.endSec - project.startSec) - 1.6).toFixed(2)}:d=1.5[m];[a0][m]amix=inputs=2:duration=first:dropout_transition=2,alimiter=limit=0.95[a]" \\
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart \\
  "${out}"`
    : `# 3. No music track selected — original audio only.
ffmpeg -y -i cut.mp4 -c copy -movflags +faststart "${out}"`;

  return `#!/usr/bin/env bash
# ------------------------------------------------------------------
#  ShortsLab export — "${project.title}"
#  Source : ${video.title} (${video.author})
#  Clip   : ${start}s → ${(project.startSec + Math.max(1, project.endSec - project.startSec)).toFixed(2)}s  (${dur}s @ 9:16)
#  Layout : ${project.layout}    Captions: ${project.captionStyle}
#  Music  : ${track ? `${track.title} — ${track.license}` : "none"}
#
#  Requirements: yt-dlp + ffmpeg   (macOS: brew install yt-dlp ffmpeg)
#  Usage: bash render.sh
# ------------------------------------------------------------------
set -euo pipefail

FONT="$(fc-match -f '%{file}' 'DejaVuSans-Bold' 2>/dev/null || echo /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf)"

# 1. Download the source video (up to 1080p)
yt-dlp -f "bv*[height<=1080]+ba/b" -o source.mp4 "${url}"

# 2. Trim + reframe to 1080x1920 and burn the hook caption
ffmpeg -y -ss ${start} -t ${dur} -i source.mp4 \\
  -filter_complex "${filter}" \\
  -map "[vout]" -map 0:a? \\
  -c:v libx264 -preset medium -crf 20 -r 30 -pix_fmt yuv420p \\
  -c:a aac -b:a 192k cut.mp4

${musicBlock}

echo "✅ Done → ${out}"
`;
}

export function buildRecipeJson(
  project: ProjectDTO,
  video: VideoDTO,
  track: TrackDTO | null,
) {
  return JSON.stringify(
    {
      generator: "ShortsLab",
      version: 1,
      source: {
        platform: "youtube",
        id: video.youtubeId,
        url: `https://www.youtube.com/watch?v=${video.youtubeId}`,
        title: video.title,
        channel: video.author,
      },
      short: {
        title: project.title,
        hookText: project.hookText,
        startSec: project.startSec,
        endSec: project.endSec,
        durationSec: Number((project.endSec - project.startSec).toFixed(2)),
        aspectRatio: "9:16",
        resolution: "1080x1920",
        layout: project.layout,
        captionStyle: project.captionStyle,
      },
      music: track
        ? {
            title: track.title,
            mood: track.mood,
            bpm: track.bpm,
            seed: track.seed,
            rootHz: track.rootHz,
            chords: track.chords,
            scale: track.scale,
            drums: track.drums,
            license: track.license,
            volume: project.musicVolume / 100,
            duckOriginalTo: project.duckVolume / 100,
          }
        : null,
    },
    null,
    2,
  );
}
