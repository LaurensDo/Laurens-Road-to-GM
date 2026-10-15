/**
 * Zitate für das Startbild. Sinngemäß übersetzt, der Urheber wird bewusst nicht genannt, sondern als "Big Dog" angezeigt.
 * Die Reihenfolge wird gemischt und komplett durchlaufen, bevor sich etwas wiederholt.
 */
export const AUTHOR = 'Big Dog';

export const QUOTES: string[] = [
  'Taktik heißt wissen, was zu tun ist, wenn es etwas zu tun gibt. Strategie heißt wissen, was zu tun ist, wenn es nichts zu tun gibt.',
  'Alle Fehler stehen schon auf dem Brett und warten nur darauf, gemacht zu werden.',
  'Gewonnen hat, wer den vorletzten Fehler macht.',
  'Noch nie hat jemand eine Partie durch Aufgeben gewonnen.',
  'Wenn du einen guten Zug siehst, such nach einem besseren.',
  'Auf dem Schachbrett haben Lüge und Heuchelei keinen langen Bestand.',
  'Schach ist Krieg über dem Brett. Das Ziel ist, den Geist des Gegners zu brechen.',
  'Ich glaube nicht an Psychologie. Ich glaube an gute Züge.',
  'Taktik entsteht aus einer überlegenen Stellung.',
  'Schach ist das Leben.',
  'Ich gebe 98 Prozent meiner geistigen Energie für Schach. Andere geben nur zwei.',
  'Schach verlangt völlige Konzentration.',
  'Ich sehe nur einen Zug voraus, aber es ist immer der richtige.',
  'Aus einer verlorenen Partie lernst du viel mehr als aus einer gewonnenen.',
  'Wer besser werden will, muss zuerst das Endspiel studieren.',
  'Ein guter Spieler hat immer Glück.',
  'Führ den Gegner in einen tiefen, dunklen Wald, in dem zwei plus zwei fünf ergibt und der Weg hinaus nur für einen breit genug ist.',
  'Es gibt zwei Arten von Opfern: die richtigen und meine.',
  'Der König ist eine Kampffigur.',
  'Die Drohung ist stärker als die Ausführung.',
  'Schach ist die Kunst der Analyse.',
  'Schach ist alles: Kunst, Wissenschaft und Sport.',
  'Vor das Endspiel haben die Götter das Mittelspiel gesetzt.',
  'Schach hat wie die Liebe und die Musik die Kraft, Menschen glücklich zu machen.',
  'Hilf deinen Figuren, dann helfen sie dir.',
  'Die Bauern sind die Seele des Schachs.',
  'Manche denken, es sei in Ordnung zu verlieren, wenn der Gegner schön spielt. Ich nicht.',
  'Schach ist seelische Folter.',
];

const KEY = 'road-to-gm-quotes-v1';

export interface Bag {
  order: number[];
  /** Nächste Stelle in order */
  pos: number;
}

const validOrder = (o: unknown, n: number): o is number[] =>
  Array.isArray(o) && o.length === n && new Set(o).size === n && o.every((x) => Number.isInteger(x) && x >= 0 && x < n);

/** Nächster Index aus einer gemischten Reihenfolge. Ist sie durchlaufen oder kaputt, wird neu gemischt, ohne dass der zuletzt gezeigte gleich wiederkommt. */
export function nextInBag(bag: Bag | null | undefined, n: number, rnd: () => number): { index: number; bag: Bag } {
  if (bag && validOrder(bag.order, n) && Number.isInteger(bag.pos) && bag.pos >= 0 && bag.pos < n) {
    return { index: bag.order[bag.pos], bag: { order: bag.order, pos: bag.pos + 1 } };
  }
  const last = bag && validOrder(bag.order, n) ? bag.order[n - 1] : -1;
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (n > 1 && order[0] === last) [order[0], order[1]] = [order[1], order[0]];
  return { index: order[0], bag: { order, pos: 1 } };
}

export function pickQuote(rnd: () => number = Math.random): { text: string; author: string } {
  let stored: Bag | null = null;
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Bag | null;
  } catch {
    stored = null;
  }
  const { index, bag } = nextInBag(stored, QUOTES.length, rnd);
  try {
    localStorage.setItem(KEY, JSON.stringify(bag));
  } catch {
    // ohne Speicher gibt es nur keine garantierte Reihenfolge
  }
  return { text: QUOTES[index], author: AUTHOR };
}
