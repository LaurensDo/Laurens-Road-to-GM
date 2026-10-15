import type { Exercise, ExerciseFile, Meta } from './types';

const base = import.meta.env.BASE_URL;

export interface Loaded {
  exercises: Exercise[];
  byId: Map<string, Exercise>;
  meta: Meta | null;
  generated: string;
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
  return { exercises: file.exercises, byId, meta, generated: file.generated };
}
