import type { Exercise, Settings } from './types';

/**
 * Art der Aufgabe: "Fehler-Training" (Fehlerstellung aus deinen Partien), "Sicher gewinnen" (klar gewonnene Stellung) oder "Endspiel"
 * (höchstens 7 Steine, exakt bewertet mit der Tablebase). Jede Art hat ihren eigenen Satz, ihr eigenes Zeitlimit und ihre eigene Warteschlange.
 */
export type TaskType = 'fehler' | 'sicher' | 'endspiel';

export const TASK_TYPES: TaskType[] = ['fehler', 'sicher', 'endspiel'];

export const TASK_LABEL: Record<TaskType, string> = { fehler: 'Fehler-Training', sicher: 'Sicher gewinnen', endspiel: 'Endspiel' };

type Typed = Pick<Exercise, 'win' | 'tb'>;

export const taskType = (ex: Typed | null | undefined): TaskType => (ex?.tb ? 'endspiel' : ex?.win ? 'sicher' : 'fehler');

/** Zeitlimit in Sekunden für diese Aufgabe (0 = aus): Jede Art hat ihre eigene Einstellung. */
export const limitFor = (s: Pick<Settings, 'timeLimit' | 'winLimit' | 'endLimit'>, ex: Typed | null | undefined): number => {
  const t = taskType(ex);
  return t === 'sicher' ? s.winLimit : t === 'endspiel' ? s.endLimit : s.timeLimit;
};

/** Art eines Satzes aus seinen Antworten: Sätze sind rein, alle Antworten haben dieselbe Art (alte Sätze mit Mischung zählen als Fehler-Training). */
export const modeOfEntries = (entries: { id: string }[], byId: Map<string, Typed>): TaskType => {
  const first = entries.length ? taskType(byId.get(entries[0].id)) : 'fehler';
  return entries.every((e) => taskType(byId.get(e.id)) === first) ? first : 'fehler';
};
