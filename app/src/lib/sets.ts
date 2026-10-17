import { correct, slowCorrect } from './stats';
import { n0, n1 } from './format';
import { expectedOf } from './skill';
import type { Exercise, ReviewEntry } from './types';

/**
 * Aufgabensätze: Eine Runde mit fester Zahl Aufgaben, am Ende Ergebnis und Einordnung.
 * Die Zugehörigkeit steht an jeder Antwort im Verlauf (entry.set), dadurch laufen Sätze automatisch
 * mit dem Abgleich auf das andere Gerät. Nur der gerade laufende Satz liegt lokal (localStorage).
 */

export interface ActiveSet {
  id: string;
  startedAt: number;
  size: number;
  /** Übungen, die in diesem Satz schon vorkamen (auch die gerade offene) */
  served: string[];
}

const KEY = 'road-to-gm-activeset-v1';
/** Ein liegengebliebener Satz wird nach dieser Zeit nicht mehr fortgesetzt */
export const RESUME_WINDOW_MS = 6 * 3600 * 1000;

export function newSetId(now: number): string {
  return `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function loadActive(now = Date.now()): ActiveSet | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Partial<ActiveSet>;
    if (typeof a.id !== 'string' || typeof a.startedAt !== 'number' || typeof a.size !== 'number' || !Array.isArray(a.served)) return null;
    if (now - a.startedAt > RESUME_WINDOW_MS) return null;
    return { id: a.id, startedAt: a.startedAt, size: a.size, served: a.served.map(String) };
  } catch {
    return null;
  }
}

export function saveActive(a: ActiveSet | null): void {
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a));
    else localStorage.removeItem(KEY);
  } catch {
    // ohne Speicher gibt es nur kein Fortsetzen
  }
}

// ---- Auswertung

export interface SetRun {
  id: string;
  planned: number;
  entries: ReviewEntry[];
  startTs: number;
  endTs: number;
}

/** Alle Sätze aus dem Verlauf, älteste zuerst. */
export function listSets(log: ReviewEntry[]): SetRun[] {
  const runs = new Map<string, SetRun>();
  for (const e of log) {
    if (!e.set) continue;
    let r = runs.get(e.set.id);
    if (!r) {
      r = { id: e.set.id, planned: e.set.n, entries: [], startTs: e.ts, endTs: e.ts };
      runs.set(e.set.id, r);
    }
    r.entries.push(e);
    r.startTs = Math.min(r.startTs, e.ts);
    r.endTs = Math.max(r.endTs, e.ts);
    r.planned = Math.max(r.planned, e.set.n);
  }
  for (const r of runs.values()) r.entries.sort((a, b) => a.ts - b.ts);
  return [...runs.values()].sort((a, b) => a.startTs - b.startTs);
}

export interface Group {
  label: string;
  right: number;
  n: number;
}

export type Tier = 'strong' | 'solid' | 'mixed' | 'hard';

export interface SetSummary {
  n: number;
  planned: number;
  complete: boolean;
  right: number;
  inTime: number;
  slowRight: number;
  quickWrong: number;
  gaveUp: number;
  rate: number; // Prozent
  avgMs: number;
  /** Richtwert der Quote für Spieler deiner Stärke, Prozent. null, wenn zu wenige Maia-Werte vorliegen. */
  expected: number | null;
  tier: Tier;
  headline: string;
  lines: string[];
  strong: Group | null;
  weak: Group | null;
  tip: string;
}

export interface SummaryOptions {
  /** aktuelles Zeitlimit in Sekunden für den Text, 0 = aus. Ob eine Antwort zu langsam war, steht in ihrer Note. */
  limit: number;
  /** Quoten (Prozent) der letzten abgeschlossenen Sätze davor, neueste zuletzt */
  previous: number[];
  /** Zählen gleichwertige Züge als richtig? Bestimmt, welcher Richtwert gilt. */
  tolerance: boolean;
}

/** Fehler, die schneller als so viele Millisekunden kamen, gelten als vorschnell */
export const QUICK_MS = 3000;

const HEADLINES: Record<Tier, string> = {
  strong: 'Starker Satz',
  solid: 'Solider Satz',
  mixed: 'Durchwachsener Satz',
  hard: 'Schwerer Satz',
};

function groupsOf(entries: ReviewEntry[], byId: Map<string, Exercise>): Group[] {
  const acc = new Map<string, Group>();
  const add = (label: string, e: ReviewEntry) => {
    const g = acc.get(label) ?? { label, right: 0, n: 0 };
    g.n++;
    if (correct(e)) g.right++;
    acc.set(label, g);
  };
  for (const e of entries) {
    const ex = byId.get(e.id);
    if (!ex) continue;
    add(ex.phase, e);
    add(ex.cat, e);
    ex.motifs.forEach((m) => add(m, e));
  }
  return [...acc.values()].filter((g) => g.n >= 2);
}

/** Wertet einen Satz nach festen Regeln aus. Keine KI, jede Aussage folgt aus den Zahlen. */
export function summarize(entries: ReviewEntry[], planned: number, byId: Map<string, Exercise>, opt: SummaryOptions): SetSummary {
  const n = entries.length;
  const right = entries.filter(correct).length;
  // nach der Note beim Antworten: Ein später geändertes Zeitlimit deutet alte Antworten nicht um
  const slowRight = entries.filter(slowCorrect).length;
  const inTime = right - slowRight;
  const quickWrong = entries.filter((e) => !correct(e) && e.verdict !== 'gaveup' && e.ms < QUICK_MS).length;
  const gaveUp = entries.filter((e) => e.verdict === 'gaveup').length;
  const rate = n ? (100 * right) / n : 0;
  const avgMs = n ? entries.reduce((a, e) => a + e.ms, 0) / n : 0;

  const withMaia = entries.map((e) => {
    const ex = byId.get(e.id);
    return ex ? expectedOf(ex, opt.tolerance) : null;
  }).filter((x): x is number => typeof x === 'number');
  const expected = n > 0 && withMaia.length >= Math.ceil(n * 0.6) ? (100 * withMaia.reduce((a, x) => a + x, 0)) / withMaia.length : null;

  let tier: Tier;
  if (rate >= 80 && inTime / Math.max(1, n) >= 0.6) tier = 'strong';
  else if (rate >= 60) tier = 'solid';
  else if (rate >= 40) tier = 'mixed';
  else tier = 'hard';

  const lines: string[] = [];
  let first = `${n0(right)} von ${n0(n)} richtig (${n0(rate)} %).`;
  if (expected !== null) {
    const diff = rate - expected;
    const ref = `Richtwert für Spieler deiner Stärke bei diesen Stellungen: ${n0(expected)} %.`;
    if (diff >= 15) first += ` ${ref} Du liegst deutlich darüber.`;
    else if (diff >= -10) first += ` ${ref} Du liegst im erwarteten Bereich.`;
    else first += ` ${ref} Du liegst darunter, die Aufgaben sind dir heute schwerer gefallen.`;
  }
  lines.push(first);

  if (opt.limit > 0) {
    let t = `${n0(inTime)} von ${n0(n)} richtig und innerhalb von ${n0(opt.limit)} s, im Schnitt ${n1(avgMs / 1000)} s je Aufgabe.`;
    if (slowRight >= 2) t += ` ${n0(slowRight)} richtige Antworten kamen erst nach dem Limit. In der Partie fehlt dir diese Zeit später auf der Uhr.`;
    lines.push(t);
  } else {
    lines.push(`Im Schnitt ${n1(avgMs / 1000)} s je Aufgabe.`);
  }
  if (quickWrong >= 2) {
    lines.push(`${n0(quickWrong)} Fehler kamen in unter ${n0(QUICK_MS / 1000)} Sekunden. Das spricht für vorschnelles Ziehen, weniger für fehlendes Wissen.`);
  }
  if (gaveUp >= 2) lines.push(`Bei ${n0(gaveUp)} Aufgaben hast du die Lösung angezeigt. Sie kommen bald wieder.`);

  const groups = groupsOf(entries, byId);
  const strong =
    groups
      .filter((g) => g.right / g.n >= 0.8)
      .sort((a, b) => b.n - a.n || b.right / b.n - a.right / a.n)[0] ?? null;
  const weak =
    groups
      .filter((g) => g.right / g.n <= 0.4)
      .sort((a, b) => a.right / a.n - b.right / b.n || b.n - a.n)[0] ?? null;

  let tip: string;
  if (quickWrong >= 2) tip = 'Zähle vor dem Ziehen bis zwei und prüfe Schachgebote, Schlagzüge und hängende Figuren.';
  else if (slowRight >= 2) tip = 'Suche zuerst die erzwingenden Züge (Schach, Schlagen, Drohen) und entscheide dann. Das spart Uhrzeit.';
  else if (weak) tip = `Schwerpunkt für die nächsten Sätze: ${weak.label}. In den Einstellungen kannst du den Filter darauf stellen.`;
  else if (tier === 'strong') tip = 'Genauigkeit und Tempo passen. Mehr Druck bekommst du mit einem kürzeren Zeitlimit in den Einstellungen.';
  else tip = 'Der nächste Satz festigt, was gerade noch wackelt. Falsche Aufgaben kommen bald automatisch wieder.';

  const prev = opt.previous.slice(-5);
  if (prev.length >= 2) {
    const avg = prev.reduce((a, x) => a + x, 0) / prev.length;
    const d = rate - avg;
    const word = d >= 10 ? 'besser' : d <= -10 ? 'schwächer' : 'ähnlich';
    lines.push(`Dein Schnitt der letzten ${prev.length} Sätze: ${n0(avg)} %. Dieser Satz war ${word}.`);
  }
  if (n < 5) lines.push('Kurzer Satz, die Einordnung ist nur eine grobe Momentaufnahme.');

  return {
    n,
    planned,
    complete: n >= planned,
    right,
    inTime,
    slowRight,
    quickWrong,
    gaveUp,
    rate,
    avgMs,
    expected,
    tier,
    headline: HEADLINES[tier],
    lines,
    strong,
    weak,
    tip,
  };
}

/** Quote eines Satzes ohne weitere Auswertung (für Verlauf und Heute). */
export function rateOf(run: SetRun): number {
  return run.entries.length ? (100 * run.entries.filter(correct).length) / run.entries.length : 0;
}
