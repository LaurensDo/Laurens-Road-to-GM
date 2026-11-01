import { countsForSchedule } from './merge';
import { dayKey, n0, n1 } from './format';
import { COMEBACK_DAYS } from './queue';
import { AUTHOR, POTS, nextInBag, type Bag, type Pot } from './quotes';
import { QUICK_MS } from './sets';
import { correct, slowCorrect } from './stats';
import type { Exercise, ReviewEntry } from './types';

/**
 * Das Satzende (Roadmap Schritt 4): Damals-Zeile, Moment des Satzes, Big Dog zur Lage und die Zweite Chance.
 * Alles aus festen Regeln und den gespeicherten Daten, kein freier Text.
 */

const GAME_RES: Record<string, string> = { win: 'Gewinn', 'cursed-win': 'Remis', draw: 'Remis', 'blessed-loss': 'Remis', loss: 'Verlust' };

/** "0:38" */
function clockText(s: number): string {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** Was der Partiezug damals kostete, als Satzende: ", kostete einen Läufer", ", aus Gewinn wurde Remis". Leer, wenn nichts Greifbares. */
function costOf(ex: Exercise): string {
  if (ex.tb) {
    const g = ex.tb.game;
    return g && GAME_RES[g[0]] !== GAME_RES[g[1]] ? `, aus ${GAME_RES[g[0]]} wurde ${GAME_RES[g[1]]}` : '';
  }
  const a = ex.why?.against.find((x) => x[0] === ex.played.san)?.[1];
  if (a?.mate) return ', danach Matt';
  if (a?.words) return `, kostete ${a.words}`;
  if (a?.new) return `, der Gegner bekam ${a.new}`;
  return ex.loss >= 10 ? `, ${n0(ex.loss)} Punkte Gewinnchance weg` : '';
}

/**
 * Damals-Zeile für eine gelöste Aufgabe: "Damals: Lxf7 nach 1,4 s, 0:38 auf der Uhr, kostete einen Läufer. Heute: Sd5 in 3,1 s."
 * Bei "Sicher gewinnen" ging es um die Zeit: "Damals: 24 s nachgedacht, 1:30 auf der Uhr." Bei Misserfolg null.
 */
export function thenLine(ex: Exercise, e: ReviewEntry): string | null {
  if (!correct(e) || !e.san) return null;
  const spent = typeof ex.spent === 'number' && ex.spent > 0 ? ex.spent : null;
  const clock = typeof ex.clock === 'number' && ex.clock > 0 ? `, ${clockText(ex.clock)} auf der Uhr` : '';
  const damals = ex.win
    ? `${spent !== null ? `${n1(spent)} s nachgedacht` : ex.played.san}${clock}`
    : `${ex.played.san}${spent !== null ? ` nach ${n1(spent)} s` : ''}${clock}${costOf(ex)}`;
  return `Damals: ${damals}. Heute: ${e.san} in ${n1(e.ms / 1000)} s.`;
}

/** Wie schwer der Fehler damals wog: Prozentpunkte Gewinnchance, im Endspiel 50 je Stufe (Gewinn → Remis → Verlust). Bei "Sicher gewinnen" 0. */
function weightOf(ex: Exercise): number {
  if (ex.win) return 0;
  if (ex.tb) {
    const lvl = (r: string) => (GAME_RES[r] === 'Gewinn' ? 2 : GAME_RES[r] === 'Remis' ? 1 : 0);
    const g = ex.tb.game;
    return g ? Math.max(0, lvl(g[0]) - lvl(g[1])) * 50 : 0;
  }
  return ex.loss;
}

/** Ab so vielen Punkten Verlust damals ist eine gelöste Aufgabe ein "Moment des Satzes" */
export const MOMENT_MIN = 30;

/** Der Moment des Satzes: die gelöste Aufgabe, deren Fehler damals am meisten kostete (mindestens MOMENT_MIN). Sonst null. */
export function momentOf(entries: ReviewEntry[], byId: Map<string, Exercise>): { e: ReviewEntry; ex: Exercise; line: string } | null {
  let best: { e: ReviewEntry; ex: Exercise; w: number } | null = null;
  for (const e of entries) {
    const ex = byId.get(e.id);
    if (!ex || !correct(e)) continue;
    const w = weightOf(ex);
    if (w >= MOMENT_MIN && (!best || w > best.w || (w === best.w && e.ms < best.e.ms))) best = { e, ex, w };
  }
  const line = best ? thenLine(best.ex, best.e) : null;
  return best && line ? { e: best.e, ex: best.ex, line } : null;
}

export interface Situation {
  pot: Pot;
  /** die sachliche Zeile neben dem Spruch */
  fact: string;
}

/**
 * Die Lage nach einem Satz, für den passenden Topf. Reihenfolge nach Seltenheit: Dauerbrenner geknackt, dritter Fehler in derselben Stellung,
 * alles richtig, Rückkehr nach einer Pause, vorschnelle Fehler, langsame richtige Antworten, schwerer Satz. null, wenn nichts davon zutrifft.
 * `entries` sind die gewerteten Antworten des Satzes, `log` der ganze Verlauf (für frühere Fehlversuche und Pausen).
 */
export function situationOf(entries: ReviewEntry[], planned: number, log: ReviewEntry[]): Situation | null {
  if (!entries.length) return null;
  const scored = log.filter(countsForSchedule);
  const wrongBefore = (e: ReviewEntry, incl: boolean) => scored.filter((x) => x.id === e.id && (incl ? x.ts <= e.ts : x.ts < e.ts) && !correct(x)).length;
  const n = entries.length;
  const right = entries.filter(correct).length;

  for (const [i, e] of entries.entries()) {
    if (correct(e) && !slowCorrect(e)) {
      const k = wrongBefore(e, false);
      if (k >= 3) return { pot: 'geknackt', fact: `Aufgabe ${i + 1}: nach ${k} Fehlversuchen jetzt richtig, in ${n1(e.ms / 1000)} s.` };
    }
  }
  for (const [i, e] of entries.entries()) {
    if (!correct(e)) {
      const k = wrongBefore(e, true);
      if (k >= 3) return { pot: 'dritterFehler', fact: `Aufgabe ${i + 1} war zum ${k}. Mal falsch. Sie kommt bald wieder.` };
    }
  }
  if (n >= planned && n >= 5 && right === n) return { pot: 'perfekt', fact: `${n0(n)} von ${n0(n)} richtig.` };
  const first = entries[0].ts;
  const prev = scored.filter((x) => x.ts < first).reduce((m, x) => Math.max(m, x.ts), -Infinity);
  if (prev > -Infinity) {
    const days = Math.round((new Date(dayKey(first)).getTime() - new Date(dayKey(prev)).getTime()) / 86400000);
    if (days >= COMEBACK_DAYS) return { pot: 'rueckkehr', fact: `Erster Satz nach ${n0(days)} Tagen Pause.` };
  }
  const quick = entries.filter((e) => !correct(e) && e.verdict !== 'gaveup' && e.ms < QUICK_MS).length;
  if (quick >= 2) return { pot: 'vorschnell', fact: `${n0(quick)} Fehler kamen in unter ${n0(QUICK_MS / 1000)} Sekunden.` };
  const slow = entries.filter(slowCorrect).length;
  if (slow >= 2) return { pot: 'langsam', fact: `${n0(slow)} richtige Antworten kamen erst nach der Zielzeit.` };
  if (n >= 5 && right / n < 0.4) return { pot: 'schwer', fact: `${n0(right)} von ${n0(n)} richtig. Die falschen kommen wieder.` };
  return null;
}

const DOG_KEY = 'road-to-gm-bigdog-v1';

interface DogState {
  /** Kam auf der letzten Ergebnisseite ein Spruch? Dann diesmal keiner (höchstens jede zweite Seite). */
  last: boolean;
  bags: Partial<Record<Pot, Bag>>;
}

function loadDog(): DogState {
  try {
    const r = JSON.parse(localStorage.getItem(DOG_KEY) ?? 'null') as Partial<DogState> | null;
    return { last: r?.last === true, bags: r?.bags && typeof r.bags === 'object' ? r.bags : {} };
  } catch {
    return { last: false, bags: {} };
  }
}

function saveDog(s: DogState): void {
  try {
    localStorage.setItem(DOG_KEY, JSON.stringify(s));
  } catch {
    // ohne Speicher wiederholt sich höchstens ein Spruch früher
  }
}

/**
 * Spruch für diese Ergebnisseite: aus dem Topf der Lage, höchstens auf jeder zweiten Seite, jeder Topf wird durchgemischt durchlaufen.
 * Einmal je Ergebnisseite aufrufen (merkt sich, dass ein Spruch kam). Abgeschaltet oder ohne Lage: null.
 */
export function bigDogFor(sit: Situation | null, enabled: boolean, rnd: () => number = Math.random): { text: string; author: string; fact: string } | null {
  const st = loadDog();
  if (!enabled || !sit || st.last) {
    if (st.last) saveDog({ ...st, last: false });
    return null;
  }
  const pot = POTS[sit.pot];
  const { index, bag } = nextInBag(st.bags[sit.pot], pot.length, rnd);
  saveDog({ last: true, bags: { ...st.bags, [sit.pot]: bag } });
  return { text: pot[index], author: AUTHOR, fact: sit.fact };
}

/** Zweite Chance: höchstens so viele falsche Aufgaben, frühestens so lange nach dem Fehler, nur in einem Satz, der noch nicht so lange läuft */
export const RETRY_MAX = 3;
export const RETRY_MIN_GAP_MS = 30_000;
export const RETRY_WINDOW_MS = 15 * 60_000;

/**
 * Welche Aufgaben die Zweite Chance anbietet: die falschen des Satzes (auch "Lösung angezeigt"), jede einmal, frühestens 30 s nach dem Fehler,
 * höchstens drei, in neuer Reihenfolge. Leer, wenn der Satz schon 15 Minuten läuft. Die Antworten zählen nicht (kind 'retry').
 */
export function retryCandidates(entries: ReviewEntry[], startedAt: number, now: number, rnd: () => number = Math.random): string[] {
  if (now - startedAt > RETRY_WINDOW_MS) return [];
  const ids: string[] = [];
  for (const e of entries) {
    if (!correct(e) && now - e.ts >= RETRY_MIN_GAP_MS && !ids.includes(e.id)) ids.push(e.id);
  }
  // die ältesten zuerst: Dort liegt das Vergessen am längsten zurück
  const picked = ids.slice(0, RETRY_MAX);
  const out = [...picked];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // neue Reihenfolge: nie genau wie im Satz
  if (out.length > 1 && out.every((id, i) => id === picked[i])) out.push(out.shift()!);
  return out;
}
