import { n0, pct, seconds } from './format';
import type { Exercise } from './types';

const CAT_TEXT: Record<string, string> = {
  'Figur eingestellt': 'In der Partie hast du hier eine Figur eingestellt.',
  'Matt übersehen': 'In der Partie hast du hier ein Matt übersehen.',
  'Gegnerische Taktik übersehen': 'In der Partie hast du hier eine gegnerische Taktik übersehen.',
  'Gegnerfehler nicht bestraft': 'Der Gegner hatte gepatzt, und du hast es in der Partie nicht bestraft.',
  'Positioneller Fehler': 'In der Partie war das hier ein positioneller Fehler, der viel Gewinnchance gekostet hat.',
  Endspiel:
    'Endspiel mit höchstens sieben Steinen: Das Ergebnis ist exakt bekannt (Tablebase). Richtig ist jeder Zug, der es hält, Gewinn bleibt Gewinn, Remis bleibt Remis.',
  'Sicher gewinnen': 'Hier stehst du klar gewonnen. Jeder Zug, der die Gewinnstellung hält, ist richtig. Es geht um Tempo, nicht um den besten Zug.',
};

const MATE = /^Matt in \d+$|^Grundreihenmatt$/;

/**
 * Motive richtig zuordnen: `motifs` beschreiben, was der Gegner nach deinem Fehler ausnutzt (die Widerlegung), `missed` das, was in
 * der besten Fortsetzung zu holen war. Ohne diese Unterscheidung stand bei "Matt übersehen" nur "Matt in 1", und man wusste nicht,
 * ob man selbst mattsetzen konnte oder gematt wurde.
 */
export function motifLines(ex: Exercise): string[] {
  const out: string[] = [];
  const mates = ex.motifs.filter((m) => MATE.test(m));
  const tactics = ex.motifs.filter((m) => !MATE.test(m));
  if (mates.length) out.push(`Der Gegner droht: ${mates[0]}.`);
  if (tactics.length) out.push(`Der Gegner nutzt aus: ${tactics.slice(0, 3).join(', ')}.`);
  // was in der besten Fortsetzung steckt, steht jetzt in der Zeile "Idee" (why.ts), sofern die Übung dazu Angaben hat
  if (!ex.motifs.length && ex.missed?.length && !ex.why) out.push(`In der besten Fortsetzung steckt: ${ex.missed.slice(0, 3).join(', ')}.`);
  return out;
}

/** Kurze, feste Erklärung zu einer Übung aus den gespeicherten Fakten. */
export function explain(ex: Exercise, tolerance = true): string[] {
  const out: string[] = [];
  out.push(CAT_TEXT[ex.cat] ?? 'In der Partie war das hier ein Fehler.');
  out.push(...motifLines(ex));
  const time =
    ex.spent === null
      ? `In der Partie hattest du noch ${n0(ex.clock)} s auf der Uhr.`
      : `In der Partie hattest du noch ${n0(ex.clock)} s auf der Uhr und hast ${seconds(ex.spent * 1000)} gebraucht.`;
  out.push(ex.spent !== null && ex.spent < 2 ? `${time} Der Zug kam sehr schnell.` : time);
  const ok = tolerance ? ex.maia.ok : ex.maia.ok0;
  if (typeof ok === 'number') {
    out.push(`Spieler deiner Stärke finden hier einen richtigen Zug in etwa ${pct(ok * 100)} der Fälle.`);
  } else if (ex.maia.me !== null) {
    out.push(`Spieler deiner Stärke finden den besten Zug in etwa ${pct(ex.maia.me * 100)} der Fälle.`);
  }
  return out;
}

/** "14...Nf6" bzw. "7.Nf3": letzter Zug des Gegners mit Zugnummer. null, wenn er nicht bekannt ist. */
export function lastMoveLabel(ex: Exercise): string | null {
  if (!ex.prev) return null;
  const full = Number(ex.fen.split(' ')[5]);
  if (!Number.isFinite(full)) return ex.prev.san;
  // Weiß am Zug: Der Gegner (Schwarz) hat gezogen, in der Zugnummer davor.
  return ex.turn === 'w' ? `${full - 1}...${ex.prev.san}` : `${full}.${ex.prev.san}`;
}

export function sideName(turn: 'w' | 'b'): string {
  return turn === 'w' ? 'Weiß' : 'Schwarz';
}
