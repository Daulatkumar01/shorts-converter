/**
 * ShortsLab generative music engine.
 *
 * Nothing here is a sample or a recording: every track is a small piece of
 * musical DNA (seed + chords + scale + drum style) that is synthesised live in
 * the browser with oscillators and noise bursts. That means the audio is
 * original by construction -> zero copyright claims, zero Content ID matches.
 *
 * The same score builder is used for:
 *   1. live preview (AudioContext + AnalyserNode for the visualiser)
 *   2. offline stem export (OfflineAudioContext -> WAV download)
 */

export type MusicTrackInput = {
  seed: number;
  bpm: number;
  rootHz: number;
  chords: string;
  scale: string;
  drums: string;
};

type NoteEvent = {
  time: number;
  freq: number;
  dur: number;
  gain: number;
  voice: "pad" | "bell" | "bass";
};

type DrumEvent = {
  time: number;
  kind: "kick" | "hat" | "snare";
  gain: number;
};

type Score = { notes: NoteEvent[]; drums: DrumEvent[]; duration: number };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const semi = (rootHz: number, n: number) => rootHz * Math.pow(2, n / 12);

export function buildScore(t: MusicTrackInput, duration: number): Score {
  const rnd = mulberry32(t.seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length) % arr.length];

  const chordSets = t.chords
    .split(";")
    .map((c) => c.split(",").map((n) => Number(n.trim())).filter(Number.isFinite));
  const scale = t.scale
    .split(",")
    .map((n) => Number(n.trim()))
    .filter(Number.isFinite);

  const spb = 60 / Math.max(40, Math.min(180, t.bpm));
  const barLen = spb * 4;
  const bars = Math.ceil(duration / barLen) + 1;

  const notes: NoteEvent[] = [];
  const drums: DrumEvent[] = [];

  for (let bar = 0; bar < bars; bar++) {
    const chord = chordSets.length
      ? chordSets[bar % chordSets.length]
      : [0, 3, 7, 10];
    const at = bar * barLen;
    const movement = bar % 2 === 0 ? 0 : 12;

    // Warm sustained pad (the "aesthetic" bed)
    chord.forEach((n, i) => {
      notes.push({
        time: at,
        freq: semi(t.rootHz, n + 12 + movement),
        dur: barLen * 0.94,
        gain: i === 0 ? 0.075 : 0.05,
        voice: "pad",
      });
    });

    // Sub bass
    notes.push({
      time: at,
      freq: semi(t.rootHz, chord[0] - 12),
      dur: spb * 1.7,
      gain: 0.2,
      voice: "bass",
    });
    if (rnd() > 0.35) {
      notes.push({
        time: at + spb * 2.5,
        freq: semi(t.rootHz, chord[Math.min(1, chord.length - 1)] - 12),
        dur: spb * 0.9,
        gain: 0.16,
        voice: "bass",
      });
    }

    // Sparkle / arpeggio bells
    const steps = t.drums === "trap" ? 16 : 8;
    for (let s = 0; s < steps; s++) {
      const time = at + (s * barLen) / steps;
      if (rnd() > 0.58) {
        const oct = rnd() > 0.72 ? 36 : 24;
        const n = scale.length
          ? pick(scale) + oct
          : pick(chord) + 24;
        notes.push({
          time,
          freq: semi(t.rootHz, n),
          dur: 0.45 + rnd() * 0.5,
          gain: 0.055 + rnd() * 0.03,
          voice: "bell",
        });
      }
    }

    // Drums
    if (t.drums === "lofi") {
      drums.push({ time: at, kind: "kick", gain: 0.85 });
      drums.push({ time: at + spb * 2.75, kind: "kick", gain: 0.55 });
      drums.push({ time: at + spb, kind: "snare", gain: 0.4 });
      drums.push({ time: at + spb * 3, kind: "snare", gain: 0.42 });
      for (let h = 0; h < 8; h++) {
        drums.push({
          time: at + (h * barLen) / 8,
          kind: "hat",
          gain: h % 2 === 0 ? 0.16 : 0.09,
        });
      }
    } else if (t.drums === "soft") {
      drums.push({ time: at, kind: "kick", gain: 0.6 });
      for (let h = 0; h < 4; h++) {
        drums.push({ time: at + (h * barLen) / 4, kind: "hat", gain: 0.08 });
      }
    } else if (t.drums === "trap") {
      drums.push({ time: at, kind: "kick", gain: 0.9 });
      drums.push({ time: at + spb * 1.75, kind: "kick", gain: 0.7 });
      drums.push({ time: at + spb * 2.5, kind: "kick", gain: 0.6 });
      drums.push({ time: at + spb * 2, kind: "snare", gain: 0.35 });
      for (let h = 0; h < 16; h++) {
        const roll = h % 4 === 3 && rnd() > 0.5;
        drums.push({
          time: at + (h * barLen) / 16 + (roll ? 0.03 : 0),
          kind: "hat",
          gain: roll ? 0.2 : 0.13,
        });
      }
    }
  }

  return { notes, drums, duration };
}

type Ctx = BaseAudioContext;

type Buses = {
  dry: GainNode;
  wet: GainNode;
  out: GainNode;
};

const noiseCache = new WeakMap<Ctx, AudioBuffer>();
function noiseBuffer(ctx: Ctx): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;
  const len = Math.floor(ctx.sampleRate * 1.2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, buf);
  return buf;
}

const irCache = new WeakMap<Ctx, AudioBuffer>();
function impulse(ctx: Ctx): AudioBuffer {
  const cached = irCache.get(ctx);
  if (cached) return cached;
  const seconds = 2.6;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * 0.7;
    }
  }
  irCache.set(ctx, buf);
  return buf;
}

export function buildBuses(ctx: Ctx, volume = 0.8): Buses {
  const out = ctx.createGain();
  out.gain.value = volume;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 24;
  comp.ratio.value = 3.2;
  comp.attack.value = 0.008;
  comp.release.value = 0.28;

  const dry = ctx.createGain();
  dry.gain.value = 0.78;
  const wet = ctx.createGain();
  wet.gain.value = 0.34;

  const conv = ctx.createConvolver();
  conv.buffer = impulse(ctx);

  dry.connect(comp);
  wet.connect(conv);
  conv.connect(comp);
  comp.connect(out);
  out.connect(ctx.destination);

  return { dry, wet, out };
}

function route(node: AudioNode, buses: Buses) {
  node.connect(buses.dry);
  node.connect(buses.wet);
}

function playPad(ctx: Ctx, buses: Buses, ev: NoteEvent, t0: number) {
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1150;
  filter.Q.value = 0.8;

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.14;
  lfoGain.gain.value = 420;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start(t0);
  lfo.stop(t0 + ev.dur + 0.1);

  for (const detune of [-6, 5]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = ev.freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(t0);
    osc.stop(t0 + ev.dur + 0.05);
  }

  const peak = ev.gain;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.7);
  gain.gain.setValueAtTime(peak, Math.max(t0 + 0.7, t0 + ev.dur - 1.1));
  gain.gain.linearRampToValueAtTime(0.0001, t0 + ev.dur);

  filter.connect(gain);
  route(gain, buses);
}

function playBell(ctx: Ctx, buses: Buses, ev: NoteEvent, t0: number) {
  const car = ctx.createOscillator();
  car.type = "sine";
  car.frequency.value = ev.freq;

  const mod = ctx.createOscillator();
  mod.type = "sine";
  mod.frequency.value = ev.freq * 2.01;
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(ev.freq * 1.4, t0);
  modGain.gain.exponentialRampToValueAtTime(1, t0 + 0.35);
  mod.connect(modGain).connect(car.frequency);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(ev.gain, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ev.dur);

  car.connect(gain);
  route(gain, buses);
  car.start(t0);
  mod.start(t0);
  car.stop(t0 + ev.dur + 0.05);
  mod.stop(t0 + ev.dur + 0.05);
}

function playBass(ctx: Ctx, buses: Buses, ev: NoteEvent, t0: number) {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = ev.freq;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 320;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(ev.gain, t0 + 0.05);
  gain.gain.setValueAtTime(ev.gain, t0 + ev.dur * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ev.dur);

  osc.connect(filter).connect(gain);
  gain.connect(buses.dry);
  osc.start(t0);
  osc.stop(t0 + ev.dur + 0.05);
}

function playDrum(ctx: Ctx, buses: Buses, ev: DrumEvent, t0: number) {
  const gain = ctx.createGain();
  if (ev.kind === "kick") {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(135, t0);
    osc.frequency.exponentialRampToValueAtTime(44, t0 + 0.16);
    gain.gain.setValueAtTime(ev.gain * 0.9, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    osc.connect(gain);
    osc.start(t0);
    osc.stop(t0 + 0.35);
    gain.connect(buses.dry);
    return;
  }

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  if (ev.kind === "hat") {
    filter.type = "highpass";
    filter.frequency.value = 8200;
    gain.gain.setValueAtTime(ev.gain, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
  } else {
    filter.type = "bandpass";
    filter.frequency.value = 1900;
    filter.Q.value = 0.9;
    gain.gain.setValueAtTime(ev.gain, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
  }
  src.connect(filter).connect(gain);
  route(gain, buses);
  src.start(t0);
  src.stop(t0 + 0.3);
}

export function scheduleScore(
  ctx: Ctx,
  buses: Buses,
  score: Score,
  startAt: number,
) {
  for (const ev of score.notes) {
    const t0 = startAt + ev.time;
    if (ev.voice === "pad") playPad(ctx, buses, ev, t0);
    else if (ev.voice === "bell") playBell(ctx, buses, ev, t0);
    else playBass(ctx, buses, ev, t0);
  }
  for (const ev of score.drums) playDrum(ctx, buses, ev, startAt + ev.time);
}

/* ------------------------------------------------------------------ */
/* Live player                                                         */
/* ------------------------------------------------------------------ */

export class MusicPlayer {
  private ctx: AudioContext | null = null;
  private buses: Buses | null = null;
  private analyser: AnalyserNode | null = null;
  private key = "";
  private volume = 0.8;

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.buses = buildBuses(this.ctx, this.volume);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.75;
      this.buses.out.connect(this.analyser);
    }
    return this.ctx;
  }

  async play(track: MusicTrackInput, duration: number) {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
    const key = `${track.seed}:${Math.ceil(duration)}`;
    if (key === this.key) return;
    this.stop();
    const score = buildScore(track, Math.max(4, Math.min(180, duration)));
    scheduleScore(ctx, this.buses!, score, ctx.currentTime + 0.12);
    this.key = key;
  }

  stop() {
    if (!this.ctx || !this.buses) return;
    const ctx = this.ctx;
    const old = this.buses;
    this.key = "";
    try {
      old.out.gain.cancelScheduledValues(ctx.currentTime);
      old.out.gain.setValueAtTime(old.out.gain.value, ctx.currentTime);
      old.out.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    } catch {
      /* noop */
    }
    setTimeout(() => {
      try {
        old.out.disconnect();
        old.dry.disconnect();
        old.wet.disconnect();
      } catch {
        /* noop */
      }
    }, 260);
    this.buses = buildBuses(ctx, this.volume);
    if (this.analyser) this.buses.out.connect(this.analyser);
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.buses && this.ctx) {
      this.buses.out.gain.setTargetAtTime(
        this.volume,
        this.ctx.currentTime,
        0.05,
      );
    }
  }

  levels(bins = 28): number[] {
    if (!this.analyser) return new Array(bins).fill(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    const step = Math.max(1, Math.floor(data.length / bins));
    const out: number[] = [];
    for (let i = 0; i < bins; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += data[i * step + j] ?? 0;
      out.push(Math.min(1, sum / step / 190));
    }
    return out;
  }
}

/* ------------------------------------------------------------------ */
/* Offline WAV export                                                  */
/* ------------------------------------------------------------------ */

export async function renderTrackToWav(
  track: MusicTrackInput,
  duration: number,
): Promise<Blob> {
  const safe = Math.max(4, Math.min(180, Math.round(duration)));
  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(
    2,
    Math.ceil((safe + 2.5) * sampleRate),
    sampleRate,
  );
  const buses = buildBuses(ctx, 0.85);
  const score = buildScore(track, safe);
  scheduleScore(ctx, buses, score, 0.05);
  const buffer = await ctx.startRendering();
  return encodeWav(buffer);
}

function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = frames * channels * 2;
  const view = new DataView(new ArrayBuffer(44 + bytes));

  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, bytes, true);

  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([view.buffer], { type: "audio/wav" });
}
