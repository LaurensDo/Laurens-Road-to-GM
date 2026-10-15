import { getPrefs, type TimerSound } from './device';

/**
 * Töne, im Browser erzeugt (Web Audio): keine Dateien, keine Lizenzfragen, offline.
 * Jeder Ton ist eine kleine Stimme aus Rauschstößen (Holzklang) und Sinustönen. Die Stimmen bekommen den
 * AudioContext übergeben, damit sie sich auch ohne Lautsprecher berechnen und prüfen lassen.
 */

export type Sfx =
  | 'select' // Figur anklicken
  | 'move' // Zug
  | 'capture' // Schlagzug
  | 'illegal' // Zug nicht erlaubt
  | 'correct' // Aufgabe richtig
  | 'slow' // richtig, aber zu langsam
  | 'wrong' // Aufgabe falsch
  | 'start' // Uhr läuft
  | 'tick' // Sekundentick
  | 'tickLast' // letzte Sekunde
  | 'timeUp' // Zeitlimit erreicht
  | 'ui' // Auswahl in der Oberfläche
  | 'done'; // Satz geschafft

export const SFX_LABELS: Record<Sfx, string> = {
  select: 'Figur anklicken',
  move: 'Zug',
  capture: 'Schlagzug',
  illegal: 'Zug nicht erlaubt',
  correct: 'Richtig',
  slow: 'Richtig, aber langsam',
  wrong: 'Falsch',
  start: 'Uhr startet',
  tick: 'Sekundentick',
  tickLast: 'Letzte Sekunde',
  timeUp: 'Zeit abgelaufen',
  ui: 'Auswahl im Menü',
  done: 'Satz geschafft',
};

type Ctx = BaseAudioContext;

const noiseCache = new WeakMap<Ctx, AudioBuffer>();

function noise(ctx: Ctx): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    const len = Math.floor(ctx.sampleRate * 0.5);
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // festes Muster statt Zufall: jede Wiedergabe klingt gleich, Tests bleiben stabil
    let seed = 12345;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = (seed / 0xffffffff) * 2 - 1;
    }
    noiseCache.set(ctx, buf);
  }
  return buf;
}

function envelope(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

interface ToneOpts {
  type?: OscillatorType;
  f0: number;
  f1?: number;
  dur: number;
  peak: number;
  attack?: number;
}

function tone(ctx: Ctx, out: AudioNode, t: number, o: ToneOpts) {
  const attack = o.attack ?? 0.004;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f0, t);
  if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
  const g = ctx.createGain();
  envelope(g, t, o.peak, attack, o.dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + attack + o.dur + 0.03);
}

interface BurstOpts {
  type?: BiquadFilterType;
  freq: number;
  q?: number;
  dur: number;
  peak: number;
  attack?: number;
  offset?: number;
}

function burst(ctx: Ctx, out: AudioNode, t: number, o: BurstOpts) {
  const attack = o.attack ?? 0.002;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.value = o.freq;
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  envelope(g, t, o.peak, attack, o.dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, o.offset ?? 0);
  src.stop(t + attack + o.dur + 0.03);
}

/** Glockenartiger Ton: Grundton mit zwei schneller verklingenden Obertönen. */
function bell(ctx: Ctx, out: AudioNode, t: number, f: number, dur: number, peak: number) {
  tone(ctx, out, t, { f0: f, dur, peak, attack: 0.006 });
  tone(ctx, out, t, { f0: f * 2.01, dur: dur * 0.55, peak: peak * 0.35, attack: 0.004 });
  tone(ctx, out, t, { f0: f * 3.99, dur: dur * 0.3, peak: peak * 0.12, attack: 0.003 });
}

type Voice = (ctx: Ctx, out: AudioNode, t: number) => number;

/** Jede Stimme gibt ihre Dauer in Sekunden zurück. Spitzenpegel bleiben unter 1, die Lautstärke regelt der Ausgang. */
export const VOICES: Record<Sfx, Voice> = {
  select: (c, o, t) => {
    burst(c, o, t, { freq: 2400, q: 2.5, dur: 0.03, peak: 0.5 });
    tone(c, o, t, { f0: 780, f1: 620, dur: 0.04, peak: 0.12 });
    return 0.09;
  },
  move: (c, o, t) => {
    burst(c, o, t, { freq: 1100, q: 1.1, dur: 0.07, peak: 0.8, offset: 0.02 });
    burst(c, o, t, { type: 'highpass', freq: 2600, dur: 0.012, peak: 0.2, offset: 0.1 });
    tone(c, o, t, { f0: 170, f1: 75, dur: 0.1, peak: 0.5 });
    return 0.2;
  },
  capture: (c, o, t) => {
    burst(c, o, t, { freq: 1500, q: 0.9, dur: 0.09, peak: 0.95, offset: 0.05 });
    burst(c, o, t + 0.045, { freq: 900, q: 1.1, dur: 0.07, peak: 0.55, offset: 0.2 });
    burst(c, o, t, { type: 'highpass', freq: 3000, dur: 0.015, peak: 0.3, offset: 0.3 });
    tone(c, o, t, { f0: 150, f1: 58, dur: 0.14, peak: 0.65 });
    return 0.26;
  },
  illegal: (c, o, t) => {
    tone(c, o, t, { type: 'triangle', f0: 150, f1: 140, dur: 0.09, peak: 0.4 });
    tone(c, o, t + 0.085, { type: 'triangle', f0: 128, f1: 118, dur: 0.11, peak: 0.4 });
    burst(c, o, t, { type: 'lowpass', freq: 500, q: 0.7, dur: 0.15, peak: 0.25, offset: 0.1 });
    return 0.25;
  },
  correct: (c, o, t) => {
    bell(c, o, t, 659.25, 0.22, 0.34);
    bell(c, o, t + 0.1, 987.77, 0.34, 0.34);
    return 0.5;
  },
  slow: (c, o, t) => {
    bell(c, o, t, 587.33, 0.3, 0.32);
    return 0.4;
  },
  wrong: (c, o, t) => {
    tone(c, o, t, { type: 'triangle', f0: 311.13, f1: 305, dur: 0.16, peak: 0.34, attack: 0.008 });
    tone(c, o, t + 0.13, { type: 'triangle', f0: 233.08, f1: 225, dur: 0.28, peak: 0.34, attack: 0.008 });
    return 0.5;
  },
  start: (c, o, t) => {
    tone(c, o, t, { f0: 620, f1: 940, dur: 0.06, peak: 0.24, attack: 0.006 });
    return 0.1;
  },
  tick: (c, o, t) => {
    burst(c, o, t, { freq: 1800, q: 3, dur: 0.022, peak: 0.55 });
    tone(c, o, t, { f0: 1000, dur: 0.035, peak: 0.22 });
    return 0.07;
  },
  tickLast: (c, o, t) => {
    burst(c, o, t, { freq: 2300, q: 3, dur: 0.03, peak: 0.55 });
    tone(c, o, t, { f0: 1400, dur: 0.06, peak: 0.28 });
    return 0.1;
  },
  timeUp: (c, o, t) => {
    tone(c, o, t, { type: 'triangle', f0: 440, dur: 0.13, peak: 0.42, attack: 0.006 });
    tone(c, o, t + 0.16, { type: 'triangle', f0: 330, dur: 0.22, peak: 0.42, attack: 0.006 });
    return 0.45;
  },
  ui: (c, o, t) => {
    burst(c, o, t, { freq: 3000, q: 2, dur: 0.014, peak: 0.28 });
    tone(c, o, t, { f0: 1050, f1: 900, dur: 0.02, peak: 0.1 });
    return 0.05;
  },
  done: (c, o, t) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(c, o, t + i * 0.11, f, i === 3 ? 0.55 : 0.25, 0.3));
    return 0.95;
  },
};

// ---- Wiedergabe

const VOLUME = { 1: 0.5, 2: 0.9, 3: 1.3 } as const;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const lastPlayed = new Map<Sfx, number>();

type AudioSessionNav = Navigator & { audioSession?: { type: string } };

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
    } catch {
      return null;
    }
    const comp = ctx.createDynamicsCompressor();
    // nur als Schutz vor Übersteuern: greift erst bei sehr lauten Spitzen
    comp.threshold.value = -3;
    comp.knee.value = 6;
    comp.ratio.value = 12;
    comp.attack.value = 0.001;
    comp.release.value = 0.1;
    master = ctx.createGain();
    master.connect(comp).connect(ctx.destination);
  }
  return ctx;
}

function applyAudioSession(ignoreMute: boolean) {
  const s = (navigator as AudioSessionNav).audioSession;
  if (!s) return;
  const want = ignoreMute ? 'playback' : 'auto';
  if (s.type !== want) {
    try {
      s.type = want;
    } catch {
      // nicht unterstützt
    }
  }
}

/** Spielt einen Ton, sofern Ton an ist. Mehrfachauslösung desselben Tons innerhalb von 25 ms wird verschluckt. */
export function play(name: Sfx, opts: { delay?: number; gain?: number } = {}): void {
  const p = getPrefs();
  if (!p.sound) return;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('road-sfx', { detail: name }));
  const c = ensureContext();
  if (!c || !master) return;
  applyAudioSession(p.ignoreMute);
  if (c.state !== 'running') void c.resume().catch(() => undefined);
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -1e9) < 25 && !opts.delay) return;
  lastPlayed.set(name, now);
  const out = c.createGain();
  out.gain.value = VOLUME[p.volume] * (opts.gain ?? 1);
  out.connect(master);
  try {
    VOICES[name](c, out, c.currentTime + 0.005 + (opts.delay ?? 0));
  } catch {
    // Ton ist nie wichtig genug, um die App zu stören
  }
}

let unlockInstalled = false;

/** iOS erlaubt Ton erst nach einer Berührung. Beim ersten Tippen den Kontext starten. */
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof document === 'undefined') return;
  unlockInstalled = true;
  const unlock = () => {
    const c = ensureContext();
    if (!c) return;
    void c.resume().catch(() => undefined);
    try {
      const b = c.createBuffer(1, 1, 22050);
      const s = c.createBufferSource();
      s.buffer = b;
      s.connect(c.destination);
      s.start(0);
    } catch {
      // egal
    }
  };
  for (const ev of ['touchend', 'pointerup', 'click', 'keydown'] as const) {
    document.addEventListener(ev, unlock, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') void ctx.resume().catch(() => undefined);
  });
}

// ---- Uhr

export interface Cue {
  sfx: Sfx;
  gain?: number;
}

/**
 * Welcher Ton gehört zu einer erreichten vollen Sekunde seit Aufgabenstart?
 * Aus: nichts. Nur Ende: Ton beim Ablauf. Standard: Start, Ticks in den letzten drei Sekunden, Ablauf.
 * Jede Sekunde: zusätzlich ein leiser Tick bei jeder Sekunde.
 */
export function timerCue(mode: TimerSound, limit: number, sec: number): Cue | null {
  if (mode === 'off' || limit <= 0) return null;
  const left = limit - sec;
  if (left === 0) return { sfx: 'timeUp' };
  if (mode === 'end' || left < 0) return null;
  if (left <= 3) return { sfx: left === 1 ? 'tickLast' : 'tick' };
  if (mode === 'every') return { sfx: 'tick', gain: 0.5 };
  return null;
}

export function startCue(mode: TimerSound, limit: number): boolean {
  return (mode === 'standard' || mode === 'every') && limit > 0;
}

// ---- Prüfung ohne Lautsprecher

/** Rechnet einen Ton offline (1,2 s) und gibt die Samples zurück, für die Pegelprüfung ohne Lautsprecher. */
export async function renderSfx(name: Sfx, sampleRate = 44100): Promise<Float32Array> {
  const off = new OfflineAudioContext(1, Math.ceil(1.2 * sampleRate), sampleRate);
  const out = off.createGain();
  out.gain.value = VOLUME[2];
  out.connect(off.destination);
  VOICES[name](off, out, 0.005);
  const buf = await off.startRendering();
  return buf.getChannelData(0).slice();
}
