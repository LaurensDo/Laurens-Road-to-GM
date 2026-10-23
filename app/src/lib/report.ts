import { dayKey } from './format';
import { listSets } from './sets';
import { correct } from './stats';
import type { QueueCounts } from './queue';
import type { AppState, Exercise } from './types';

/**
 * Auswertung für Claude: nur Zahlen zur Nutzung, keine Partien und keine Namen. Wird im Chat eingefügt und zeigt, was in der App
 * wirklich passiert (wie oft, wie lange, wo Sätze enden), damit Entscheidungen auf Daten statt auf Eindrücken beruhen.
 * Nichts davon erscheint als Anzeige oder Ziel in der App.
 */

export interface ReportContext {
  now: Date;
  appVersion: string;
  build: string;
  dataVersion: number;
  /** Prüfsatz-IDs (Übungen, die nie im Training vorkommen sollen) */
  holdoutIds: string[];
  byId: Map<string, Exercise>;
  /** Warteschlange des Fehler-Trainings */
  queue: QueueCounts;
  /** dasselbe für "Sicher gewinnen" und "Endspiel" (fehlt in älteren Aufrufen) */
  queueBy?: Partial<Record<'sicher' | 'endspiel', QueueCounts>>;
}

const DAY = 86400000;

/** Montag der Woche (Mittag, wegen Zeitumstellung) für `weeksBack` Wochen vor der von `now`. */
function mondayOf(now: Date, weeksBack: number): Date {
  const back = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - back - 7 * weeksBack, 12);
}

const key = (d: Date) => dayKey(d.getTime());

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function usageReport(state: AppState, c: ReportContext) {
  const log = state.log;
  const days = new Set(log.map((e) => dayKey(e.ts)));
  const now = c.now.getTime();

  // Trainingstage je Woche (Montag bis Sonntag), die letzten 8 Wochen, älteste zuerst
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const mon = mondayOf(c.now, 7 - i);
    let n = 0;
    for (let d = 0; d < 7; d++) if (days.has(key(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + d, 12)))) n++;
    return { von: key(mon), tage: n };
  });

  // Minuten je Tag, die letzten 14 Tage (Summe der gedeckelten Zeit mit den Aufgaben)
  const minutes: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) minutes[key(new Date(c.now.getFullYear(), c.now.getMonth(), c.now.getDate() - i, 12))] = 0;
  for (const e of log) {
    const k = dayKey(e.ts);
    if (k in minutes) minutes[k] += e.dur / 60000;
  }
  for (const k of Object.keys(minutes)) minutes[k] = Math.round(minutes[k] * 10) / 10;

  // Sätze der letzten 30 Tage: fertig, abgebrochen, und ob danach noch ein Satz folgte ("Nächster Satz" statt "Für heute fertig")
  const sets = listSets(log);
  const recent = sets.filter((r) => now - r.startTs < 30 * DAY);
  const done = recent.filter((r) => r.entries.length >= r.planned);
  const followed = done.filter((r) => sets.some((o) => o.startTs > r.endTs && o.startTs - r.endTs <= 10 * 60 * 1000)).length;

  // Pausen von mindestens vier Tagen und wie schnell es danach weiterging
  const sorted = [...days].sort();
  const pausen: { tage: number; trainingstageInDenErsten3Tagen: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = new Date(sorted[i - 1] + 'T12:00:00');
    const b = new Date(sorted[i] + 'T12:00:00');
    const gap = Math.round((b.getTime() - a.getTime()) / DAY);
    if (gap >= 4) {
      const after = sorted.filter((k) => k >= sorted[i] && new Date(k + 'T12:00:00').getTime() - b.getTime() <= 2 * DAY).length;
      pausen.push({ tage: gap, trainingstageInDenErsten3Tagen: after });
    }
  }

  const week = log.filter((e) => now - e.ts < 7 * DAY);
  const fast = week.filter((e) => !correct(e) && e.verdict !== 'gaveup' && e.ms < 3000).length;
  // Variantenansicht der letzten 14 Tage: bei wie vielen Antworten geöffnet und wie viel Zeit darin (steckt auch in minutenProTag)
  const fortnight = log.filter((e) => now - e.ts < 14 * DAY);
  const viewed = fortnight.filter((e) => (e.pv ?? 0) > 0);
  const holdSet = new Set(c.holdoutIds);
  const seenHold = [...new Set(log.filter((e) => holdSet.has(e.id)).map((e) => e.id))];
  const stubborn = Object.entries(state.cards)
    .filter(([, r]) => r.lapses >= 3)
    .map(([id, r]) => ({ id, fehlversuche: r.lapses, antworten: r.reviews, art: c.byId.get(id)?.cat ?? '?' }))
    .sort((x, y) => y.fehlversuche - x.fehlversuche)
    .slice(0, 30);

  return {
    app: { version: c.appVersion, build: c.build, datenstand: c.dataVersion },
    stand: dayKey(now),
    geraete: Object.fromEntries(Object.entries(state.devices).map(([n, d]) => [n, { version: d.v, zuletzt: dayKey(d.ts) }])),
    antwortenGesamt: log.length,
    trainingstageProWoche: weeks,
    minutenProTag: minutes,
    saetze30Tage: {
      gesamt: recent.length,
      fertig: done.length,
      abgebrochen: recent.length - done.length,
      naechsterSatzFolgte: done.length ? Math.round((100 * followed) / done.length) : null,
    },
    pausen,
    woche: {
      antworten: week.length,
      richtigProzent: week.length ? Math.round((100 * week.filter(correct).length) / week.length) : null,
      medianMs: median(week.map((e) => e.ms)),
      vorschnelleFehler: fast,
    },
    varianten14Tage: {
      antworten: fortnight.length,
      geoeffnet: viewed.length,
      minutenDarin: Math.round(viewed.reduce((a, e) => a + (e.pv ?? 0), 0) / 6000) / 10,
    },
    warteschlange: { heuteDran: c.queue.due, neu: c.queue.newAvailable, wartenAufSpaeter: c.queue.waiting, rueckstandTage: c.queue.backlogDays },
    ...(c.queueBy
      ? {
          warteschlangeArten: Object.fromEntries(
            Object.entries(c.queueBy).map(([m, q]) => [m, { heuteDran: q.due, neu: q.newAvailable, nochNieGesehen: q.newTotal, gesamt: q.total }]),
          ),
        }
      : {}),
    pruefsatz: { groesse: c.holdoutIds.length, schonGesehen: seenHold },
    dauerbrenner: stubborn,
  };
}

export function usageReportText(state: AppState, c: ReportContext): string {
  return `Auswertung Road to GM (nur Zahlen, keine Partien)\n${JSON.stringify(usageReport(state, c), null, 1)}`;
}
