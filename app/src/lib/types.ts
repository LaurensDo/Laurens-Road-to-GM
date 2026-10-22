export type Side = 'w' | 'b';

export interface Line {
  san: string;
  uci: string;
  wp: number; // Gewinnchance in %, aus Sicht des Ziehenden
  cp: number;
  pv: string[];
  /**
   * Gewinnchance nach jedem Halbzug der Variante, aus Sicht des Spielers, der in der Übung am Zug ist (analysis/ply_evals.py).
   * Index 0 = nach dem ersten Zug der Linie. Nur für die beste und die gleichwertigen Linien, fehlt sonst.
   */
  ev?: number[];
}

export interface Exercise {
  id: string;
  fen: string;
  turn: Side;
  phase: string;
  cat: string;
  motifs: string[];
  themes: string[];
  /** beste Züge in der Reihenfolge der Engine (MultiPV): der erste ist der beste, die Gewinnchancen der weiteren können leicht von der Reihenfolge abweichen */
  lines: Line[];
  played: { san: string; uci: string; wp: number; cp: number };
  loss: number; // Prozentpunkte, tiefe Suche
  clock: number; // Restzeit in der Partie (s)
  spent: number | null; // Bedenkzeit in der Partie (s)
  date: string;
  url: string;
  src: string;
  maia: {
    /** Wahrscheinlichkeit, dass ein Spieler deiner Stärke genau den besten Zug spielt */
    me: number | null;
    up: number | null;
    cls: string | null;
    /** Wahrscheinlichkeit, dass er einen als richtig gewerteten Zug spielt: ok mit gleichwertigen Zügen (bis 10 Punkte), ok0 nur der beste */
    ok?: number;
    ok0?: number;
    /** wie ok, für einen Spieler 300 Elo stärker */
    okUp?: number;
  };
  /** Was der Gegner droht, wenn man nichts tut (Nullzug), nur bei echter Drohung. SAN gilt in der Stellung nach einem Nullzug. */
  threat?: { uci: string; san: string; gain: number };
  /**
   * Widerlegungen falscher Züge: [Zug als SAN, die folgenden Halbzüge als SAN, Gewinnchance nach jedem Halbzug ab dem Zug selbst],
   * für den Partiezug und wahrscheinliche Fehlzüge. Die Gewinnchancen fehlen in älteren Daten.
   */
  refs?: [string, string[], number[]?][];
  /** Motive der besten Fortsetzung (was in der Stellung zu gewinnen war), bei "Gegnerfehler nicht bestraft" und anderen */
  missed?: string[];
  /** Letzter Zug des Gegners vor der Stellung: Brett davor (nur Figurenstellung), Zug als UCI und SAN */
  prev?: { board: string; uci: string; san: string };
  /**
   * Weitere bewertete Züge außerhalb der fünf besten (SAN, Gewinnchance): alle, die höchstens 40 Punkte hinter dem besten liegen.
   * Fehlt das Feld (ältere Daten), kennt die App nur `lines`. Mit dem Feld gilt: Was nirgends steht, liegt mindestens COVER_WP zurück.
   */
  more?: [string, number][];
  /** Prüfsatz: kommt nie im Training vor, nur im Monats-Check (analysis/pick_holdout.py) */
  hold?: boolean;
  /**
   * "Sicher gewinnen" (analysis/win_positions.py): Stellung, in der der Spieler klar gewonnen steht. Richtig ist jeder Zug, der mindestens
   * `safe` Prozent Gewinnchance hält, schnell gezogen. Es geht um Tempo, nicht um den besten Zug. Die Zielzeit steht in den Einstellungen
   * (`Settings.winLimit`); `limit` im Datensatz ist nur ein Richtwert und wird nicht mehr gelesen.
   */
  win?: { safe: number; limit?: number };
  /**
   * "Endspiel" (analysis/endgame_positions.py): Stellung mit höchstens 7 Steinen, exakt bewertet mit der Tablebase. `res` ist das Ergebnis der
   * Stellung für den Spieler ('w' Gewinn, 'd' Remis), `moves` alle legalen Züge mit ihrem Ergebnis ('w', 'd', 'l'). Richtig ist jeder Zug,
   * der das Ergebnis hält. `game`: was in der Partie aus der Stellung wurde (vorher, nachher, wie die Tablebase es nennt).
   */
  tb?: { res: 'w' | 'd'; moves: [string, 'w' | 'd' | 'l'][]; game?: [string, string] };
  /**
   * Warum der beste Zug richtig ist (analysis/why.py): Motive der besten Linie nach dem lichess-Tagger, was die Linie bringt, und was die Widerlegung
   * der gespeicherten Fehlzüge kostet. Gewinne sind vorsichtig gerechnet (ein Schlag zählt erst nach der Antwort des Gegners).
   */
  why?: { tags: string[]; gain: WhyOutcome | null; against: [string, WhyOutcome][] };
}

/** Ergebnis einer Linie: Matt in N oder Material in Worten ("die Qualität", "einen Springer für einen Bauern"), mit der Linie (SAN) dorthin */
export interface WhyOutcome {
  mate?: number;
  pts?: number;
  words?: string;
  line: string[];
}

export interface ExerciseFile {
  /** Datenstand: steigt, wenn sich Bewertungen oder Lösungen ändern. Steht als dv an jeder Antwort. */
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

/** Obergrenze für ReviewEntry.dur: Eine liegengebliebene Aufgabe zählt nicht als stundenlanges Training. */
export const MAX_DUR_MS = 180000;

export interface ReviewEntry {
  id: string;
  ts: number; // Zeitpunkt der Antwort
  grade: Grade;
  verdict: Verdict;
  ms: number; // Zeit bis zur Antwort
  dur: number; // gesamte Zeit mit der Aufgabe (inkl. Auswertung), höchstens MAX_DUR_MS
  san?: string;
  /** Aufgabensatz, zu dem die Antwort gehört (id) und dessen geplante Größe. Fehlt bei Einzelaufgaben. */
  set?: { id: string; n: number };
  /**
   * Art der Antwort. Fehlt = normale Aufgabe aus dem Fehler-Trainer. Andere Arten (kommen in späteren Versionen) bleiben im
   * Verlauf erhalten, gehen aber nicht in den Wiederholungsplan ein.
   */
  kind?: string;
  /** damals geltendes Zeitlimit in Sekunden (0 = aus), damit sich alte Antworten später richtig einordnen lassen */
  lim?: number;
  /** Datenstand der Übungen bei der Antwort (ExerciseFile.version) */
  dv?: number;
  /** Zeit in der Variantenansicht in ms (steckt auch in dur). Fehlt, wenn keine Variante geöffnet wurde. */
  pv?: number;
}

/** Welche App-Version ein Gerät zuletzt gemeldet hat (steht in der Sync-Datei) */
export interface DeviceInfo {
  v: string;
  ts: number;
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
  /** Zeitlimit für "Fehler-Training" (Stellungen mit einem Fehler aus deinen Partien), Sekunden, 0 = aus */
  timeLimit: number;
  /** Zielzeit für "Sicher gewinnen" (klar gewonnene Stellungen), Sekunden, 0 = aus */
  winLimit: number;
  /** Zeitlimit für "Endspiel" (Tablebase-Stellungen aus deinen Partien), Sekunden, 0 = aus */
  endLimit: number;
  tolerance: boolean; // gleichwertige Züge zählen
  newPerDay: number;
  /** Aufgaben pro Satz */
  setSize: number;
  /** Vor der Aufgabe den letzten Zug des Gegners zeigen */
  showLast: boolean;
  goalMinutes: number;
  theme: ThemeSetting;
  filters: Filters;
}

export interface HiddenEntry {
  on: boolean;
  ts: number;
}

export interface AppState {
  version: 1;
  /** Wiederholungsplan je Übung. Wird aus dem Verlauf (log) abgeleitet und beim Abgleich neu berechnet. */
  cards: Record<string, CardRecord>;
  log: ReviewEntry[];
  settings: Settings;
  /** Zeitpunkt der letzten Änderung der Einstellungen (neuere gewinnen beim Abgleich) */
  settingsTs: number;
  /** zusätzliche neue Aufgaben, die heute freigegeben wurden */
  bonus?: { day: string; n: number };
  /** ausgeblendete Übungen (z. B. fehlerhafte Stellungen), je Übung mit Zeitstempel */
  hidden: Record<string, HiddenEntry>;
  /** Zeitpunkt des letzten Zurücksetzens: ältere Antworten zählen nicht mehr */
  epoch: number;
  /**
   * Wann die Epoche festgelegt wurde (Zurücksetzen oder Wiederherstellen einer Sicherung). Beim Abgleich gilt die jüngere
   * Festlegung, so kann eine Sicherung ein Zurücksetzen auch auf dem anderen Gerät rückgängig machen.
   */
  epochTs: number;
  /** Geräte, die sich mit dieser Sync-Datei abgleichen, mit ihrer App-Version */
  devices: Record<string, DeviceInfo>;
  /** Unbekannte Felder aus der Sync-Datei einer neueren Version: werden mitgeführt und wieder geschrieben, nie verworfen */
  ext: Record<string, unknown>;
}

export const DEFAULT_SETTINGS: Settings = {
  timeLimit: 20,
  winLimit: 10,
  endLimit: 15,
  tolerance: true,
  newPerDay: 15,
  setSize: 10,
  showLast: true,
  goalMinutes: 15,
  theme: 'system',
  filters: { phase: 'alle', cat: 'alle', motif: 'alle' },
};

export function emptyState(): AppState {
  return {
    version: 1,
    cards: {},
    log: [],
    settings: { ...DEFAULT_SETTINGS, filters: { ...DEFAULT_SETTINGS.filters } },
    settingsTs: 0,
    hidden: {},
    epoch: 0,
    epochTs: 0,
    devices: {},
    ext: {},
  };
}
