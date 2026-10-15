export type Side = 'w' | 'b';

export interface Line {
  san: string;
  uci: string;
  wp: number; // Gewinnchance in %, aus Sicht des Ziehenden
  cp: number;
  pv: string[];
}

export interface Exercise {
  id: string;
  fen: string;
  turn: Side;
  phase: string;
  cat: string;
  motifs: string[];
  themes: string[];
  lines: Line[]; // beste Züge, absteigend nach Gewinnchance
  played: { san: string; uci: string; wp: number; cp: number };
  loss: number; // Prozentpunkte, tiefe Suche
  clock: number; // Restzeit in der Partie (s)
  spent: number | null; // Bedenkzeit in der Partie (s)
  date: string;
  url: string;
  src: string;
  maia: { me: number | null; up: number | null; cls: string | null };
}

export interface ExerciseFile {
  version: number;
  generated: string;
  exercises: Exercise[];
}

export interface Meta {
  version: number;
  generated: string;
  games: number;
  period: [string, string];
  baseline: Record<string, number>;
  counts: { exercises: number; by_phase: Record<string, number> };
}

/** best = bester Zug, equal = gleichwertig, playable = spielbar aber schwächer, wrong = falsch, gaveup = Lösung gezeigt */
export type Verdict = 'best' | 'equal' | 'playable' | 'wrong' | 'gaveup';
export type Grade = 1 | 2 | 3; // 1 = nochmal, 2 = schwer (zu langsam), 3 = gut

export interface ReviewEntry {
  id: string;
  ts: number; // Zeitpunkt der Antwort
  grade: Grade;
  verdict: Verdict;
  ms: number; // Zeit bis zur Antwort
  dur: number; // gesamte Zeit mit der Aufgabe (inkl. Auswertung), begrenzt
  san?: string;
}

/** Karte im Wiederholungsplan (ts-fsrs-Karte als JSON) */
export interface CardRecord {
  card: Record<string, unknown>;
  firstSeen: number;
  reviews: number;
  lapses: number;
}

export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Filters {
  phase: string; // 'alle' oder Phase
  cat: string; // 'alle' oder Fehlerart
  motif: string; // 'alle' oder Motiv
}

export interface Settings {
  timeLimit: number; // Sekunden, 0 = aus
  tolerance: boolean; // gleichwertige Züge zählen
  newPerDay: number;
  goalMinutes: number;
  theme: ThemeSetting;
  filters: Filters;
}

export interface AppState {
  version: 1;
  cards: Record<string, CardRecord>;
  log: ReviewEntry[];
  settings: Settings;
  /** zusätzliche neue Aufgaben, die heute freigegeben wurden */
  bonus?: { day: string; n: number };
  /** ausgeblendete Übungen (z. B. fehlerhafte Stellungen) */
  hidden?: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  timeLimit: 10,
  tolerance: true,
  newPerDay: 15,
  goalMinutes: 15,
  theme: 'system',
  filters: { phase: 'alle', cat: 'alle', motif: 'alle' },
};

export function emptyState(): AppState {
  return { version: 1, cards: {}, log: [], settings: { ...DEFAULT_SETTINGS, filters: { ...DEFAULT_SETTINGS.filters } } };
}
