import { n0, pct, seconds } from './format';
import type { Exercise } from './types';

const CAT_TEXT: Record<string, string> = {
  'Figur eingestellt': 'In der Partie hast du hier eine Figur eingestellt.',
  'Matt übersehen': 'In der Partie hast du hier ein Matt übersehen.',
  'Gegnerische Taktik übersehen': 'In der Partie hast du hier eine gegnerische Taktik übersehen.',
  'Gegnerfehler nicht bestraft': 'Der Gegner hatte gepatzt, und du hast es in der Partie nicht bestraft.',
  'Positioneller Fehler': 'In der Partie war das hier ein positioneller Fehler, der viel Gewinnchance gekostet hat.',
};

/** Kurze, feste Erklärung zu einer Übung aus den gespeicherten Fakten. */
export function explain(ex: Exercise): string[] {
  const out: string[] = [];
  out.push(CAT_TEXT[ex.cat] ?? 'In der Partie war das hier ein Fehler.');
  if (ex.motifs.length) out.push(`Motiv: ${ex.motifs.slice(0, 3).join(', ')}.`);
  const time =
    ex.spent === null
      ? `In der Partie hattest du noch ${n0(ex.clock)} s auf der Uhr.`
      : `In der Partie hattest du noch ${n0(ex.clock)} s auf der Uhr und hast ${seconds(ex.spent * 1000)} gebraucht.`;
  out.push(ex.spent !== null && ex.spent < 2 ? `${time} Der Zug kam sehr schnell.` : time);
  if (ex.maia.me !== null) {
    out.push(`Spieler deiner Stärke finden den besten Zug in etwa ${pct(ex.maia.me * 100)} der Fälle.`);
  }
  return out;
}

export function sideName(turn: 'w' | 'b'): string {
  return turn === 'w' ? 'Weiß' : 'Schwarz';
}
