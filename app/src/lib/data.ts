import type { Exercise, ExerciseFile, Meta } from './types';

const base = import.meta.env.BASE_URL;

export interface Loaded {
  /** Übungen fürs Training (ohne Prüfsatz) */
  exercises: Exercise[];
  /** alle Übungen inklusive Prüfsatz, damit sich auch Antworten auf Prüfstellungen noch zuordnen lassen */
  byId: Map<string, Exercise>;
  /** Prüfsatz: kommt nie im Training vor */
  holdout: Exercise[];
  meta: Meta | null;
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
  const byId = new Map(file.exercises.map((e) => [e.id, e]));
  const { train, holdout } = splitHoldout(file.exercises);
  return { exercises: train, byId, holdout, meta, generated: file.generated, dataVersion: file.version };
}
