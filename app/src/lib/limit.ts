import type { Exercise, Settings } from './types';

/** Art der Aufgabe: "Fehler-Training" (Fehlerstellung aus deinen Partien) oder "Sicher gewinnen" (klar gewonnene Stellung). */
export type TaskType = 'fehler' | 'sicher';

export const TASK_LABEL: Record<TaskType, string> = { fehler: 'Fehler-Training', sicher: 'Sicher gewinnen' };

export const taskType = (ex: Pick<Exercise, 'win'> | null | undefined): TaskType => (ex?.win ? 'sicher' : 'fehler');

/** Zeitlimit in Sekunden für diese Aufgabe (0 = aus): Jede Art hat ihre eigene Einstellung. */
export const limitFor = (s: Pick<Settings, 'timeLimit' | 'winLimit'>, ex: Pick<Exercise, 'win'> | null | undefined): number =>
  taskType(ex) === 'sicher' ? s.winLimit : s.timeLimit;
