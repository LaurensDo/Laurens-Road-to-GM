import type { UhrBasis } from './basis';
import type { Exercise, ExerciseFile, Meta } from './types';

const base = import.meta.env.BASE_URL;

export const DEFAULT_REGEL = 'Über 10 Sekunden nachgedacht und kein Schach, kein Schlag, keine Drohung? Zieh deinen besten Kandidaten.';

export interface Loaded {
  /** Übungen fürs Training (ohne Prüfsatz) */
  exercises: Exercise[];
  /** alle Übungen inklusive Prüfsatz, damit sich auch Antworten auf Prüfstellungen noch zuordnen lassen */
  byId: Map<string, Exercise>;
  /** Prüfsatz: kommt nie im Training vor */
  holdout: Exercise[];
  meta: Meta | null;
  /** eingefrorene Basis der Uhr-Auswertung (optional) */
  basis: UhrBasis | null;
  /** die eine Regel für die Partien (public/data/regel.json), mit Rückfall im Code */
  regel: string;
  generated: string;
  /** Datenstand (exercises.json: version), steht als dv an jeder Antwort */
  dataVersion: number;
}

/** Trennt den Prüfsatz vom Trainingsvorrat. */
export function splitHoldout(all: Exercise[]): { train: Exercise[]; holdout: Exercise[] } {
  return { train: all.filter((e) => !e.hold), holdout: all.filter((e) => e.hold) };
}

export async function loadData(): Promise<Loaded> {
  const res = await fetch(`${base}data/exercises.json`);
  if (!res.ok) throw new Error(`Übungen konnten nicht geladen werden (${res.status})`);
  const file = (await res.json()) as ExerciseFile;
  let meta: Meta | null = null;
  try {
    const m = await fetch(`${base}data/meta.json`);
    if (m.ok) meta = (await m.json()) as Meta;
  } catch {
    // Kennzahlen aus der Diagnose sind optional
  }
  let basis: UhrBasis | null = null;
  try {
    const b = await fetch(`${base}data/uhr-basis.json`);
    if (b.ok) basis = (await b.json()) as UhrBasis;
  } catch {
    // ohne Basis zeigt die Uhr-Karte nur die eigenen Werte
  }
  let regel = DEFAULT_REGEL;
  try {
    const r = await fetch(`${base}data/regel.json`);
    if (r.ok) regel = ((await r.json()) as { regel?: string }).regel || DEFAULT_REGEL;
  } catch {
    // Rückfall
  }
  const byId = new Map(file.exercises.map((e) => [e.id, e]));
  const { train, holdout } = splitHoldout(file.exercises);
  return { exercises: train, byId, holdout, meta, basis, regel, generated: file.generated, dataVersion: file.version };
}
