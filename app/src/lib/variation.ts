import { SAME_WP, TOLERANCE_WP } from './judge';
import type { Exercise } from './types';

/** Eine Variante, die die Ergebnisseite durchklickbar anbietet: beste Linie, gleichwertige Linien, der eigene Zug, der Zug aus der Partie. */
export interface Variation {
  /** stabile Kennung innerhalb der Übung: "l2" (Linie) oder "r:Lxf7" (gespeicherte Widerlegung) */
  key: string;
  /** erster Zug der Variante (SAN) */
  san: string;
  /** alle Halbzüge, der erste Zug eingeschlossen */
  moves: string[];
  /** Gewinnchance nach dem ersten Zug, aus Sicht des Spielers (null = nicht bekannt) */
  wp: number | null;
  /** Gewinnchance nach jedem Halbzug (Index 0 = nach dem ersten Zug), null wenn nicht gerechnet */
  ev: number[] | null;
  best: boolean;
  equal: boolean;
  /** der Zug, den der Spieler eben gespielt hat */
  own: boolean;
  /** der Zug aus der Partie */
  game: boolean;
}

/**
 * Varianten für die Ergebnisseite: die beste Linie, die gleichwertigen (nach der Einstellung wie in der Wertung), der eigene Zug und der
 * Zug aus der Partie, soweit eine Variante dazu gespeichert ist. Reihenfolge: beste, gleichwertige (beste Gewinnchance zuerst), eigener, Partie.
 */
export function buildVariations(ex: Exercise, ownSan: string | null, tolerance: boolean): Variation[] {
  const limit = tolerance ? TOLERANCE_WP : SAME_WP;
  const bestWp = ex.lines[0].wp;
  const out: Variation[] = [];
  ex.lines.forEach((l, i) => {
    const best = i === 0;
    const equal = !best && (ex.tb ? ex.tb.moves.some((m) => m[0] === l.san && m[1] === ex.tb!.res) : ex.win ? l.wp >= ex.win.safe : bestWp - l.wp <= limit);
    const own = l.san === ownSan;
    const game = l.san === ex.played.san;
    if (!best && !equal && !own && !game) return;
    // Ein falscher Zug mit gespeicherter Widerlegung (kommt auch dann vor, wenn er unter den fünf besten Linien steht): Es gilt die
    // Widerlegung. Sie wird nach dem Zug vorgeführt und im Text genannt, und nur sie hat Bewertungen je Halbzug.
    const ref = !best && !equal ? ex.refs?.find((r) => r[0] === l.san) : undefined;
    if (ref) {
      out.push({ key: `l${i}`, san: l.san, moves: [l.san, ...ref[1]], wp: l.wp, ev: ref[2]?.length ? ref[2] : null, best, equal, own, game });
      return;
    }
    out.push({ key: `l${i}`, san: l.san, moves: l.pv.length ? l.pv : [l.san], wp: l.wp, ev: l.ev?.length ? l.ev : null, best, equal, own, game });
  });
  for (const [san, pv, ev] of ex.refs ?? []) {
    if (out.some((v) => v.san === san)) continue;
    const own = san === ownSan;
    const game = san === ex.played.san;
    if (!own && !game) continue;
    out.push({ key: `r:${san}`, san, moves: [san, ...pv], wp: ev?.length ? ev[0] : null, ev: ev?.length ? ev : null, best: false, equal: false, own, game });
  }
  const rank = (v: Variation) => (v.best ? 0 : v.equal ? 1 : v.own ? 2 : 3);
  return out.sort((a, b) => rank(a) - rank(b) || (b.wp ?? -1) - (a.wp ?? -1));
}

/**
 * Gewinnchance (aus Sicht des Spielers) in der Stellung nach `step` Halbzügen der Variante. Schritt 0 und "keine Variante" = Ausgangsstellung,
 * dort gilt der beste Zug. Ohne gerechnete Werte bleibt es bei der Gewinnchance der Linie (eine Variante bleibt auf ihrem Wert), ohne
 * diese ist der Wert nicht bekannt (null).
 */
export function evAt(ex: Exercise, v: Variation | null | undefined, step: number): number | null {
  if (!v || step <= 0) return ex.lines[0].wp;
  if (v.ev) return v.ev[Math.min(step, v.ev.length) - 1];
  return v.wp;
}

/** Züge mit Zugnummer für die Zugliste: "12.Sd5", "Lxd5" (Antwort ohne Nummer), "12…Sd5" wenn Schwarz beginnt. */
export function numberedMoves(fen: string, moves: string[]): string[] {
  const parts = fen.split(' ');
  let white = parts[1] !== 'b';
  let no = Number(parts[5]) || 1;
  return moves.map((san, i) => {
    const label = white ? `${no}.${san}` : i === 0 ? `${no}…${san}` : san;
    if (!white) no++;
    white = !white;
    return label;
  });
}

/** Wörter an der Auswahl: "bester Zug", "gleichwertig", "dein Zug", "in der Partie" */
export function tagsOf(v: Variation): string {
  const t: string[] = [];
  if (v.best) t.push('bester Zug');
  else if (v.equal) t.push('gleichwertig');
  if (v.own) t.push('dein Zug');
  if (v.game) t.push('in der Partie');
  return t.join(', ');
}
