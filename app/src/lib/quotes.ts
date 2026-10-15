/**
 * Sprüche für das Startbild: Satire auf übertriebene Männlichkeit ("Big Dog"). Die Figur behauptet Härte und Souveränität
 * und entlarvt sich dabei selbst. Als Urheber steht immer "Big Dog". Die Reihenfolge wird gemischt und komplett durchlaufen,
 * bevor sich etwas wiederholt. Innere Anführungszeichen sind einfach (‚…‘), weil der ganze Spruch in „…“ steht.
 */
export const AUTHOR = 'Big Dog';

export const QUOTES: string[] = [
  // Favoriten
  'Ich opfere keine Figuren. Ich mache dem Gegner Geschenke, damit er sich schlecht fühlt.',
  'En passant? Ich nenne das beim Gassigehen kassieren.',
  'Mein Läuferpaar ist wie mein Bizepspaar: Ich muss sie nur ab und zu zeigen.',
  'Remis ist, wenn zwei Hunde sich beschnüffeln und keiner zubeißt. Ich beiße.',
  'Der Turm steht auf der offenen Linie, weil er weiß, wer hier das Sagen hat.',
  // Nie aufgeben, nie Hilfe
  'Echte Männer geben nie auf. Ich spiele noch drei Züge nach dem Matt, aus Prinzip.',
  'Ich brauche keine Analyse. Ein Big Dog lernt aus Schmerz. Seit 2021 verliere ich dieselbe Eröffnung.',
  'Ich brauche keinen Trainer. Ich brauche nur Gegner, die meine Fehler nicht bemerken.',
  'Echte Männer lesen keine Eröffnungstheorie. Sie stehen nach Zug sechs allein da und nennen es Charakter.',
  'Remis ist Schach für Leute, die auch beim Armdrücken Unentschieden vorschlagen.',
  'Wer beim Handschlag zuerst loslässt, hat verloren. Ich halte seit 2019 dieselbe Hand.',
  'Ich habe dieses Jahr 40 Remisangebote abgelehnt und 38 Partien verloren. Charakter.',
  // Ausreden und Ego
  'Ich habe nicht verloren. Mein WLAN hat verloren. Ich war nur dabei.',
  'Ich verliere nie gegen Menschen. Nur gegen Engines. Dieses Jahr: 143 Mal.',
  'Ich bin nicht wütend. So bewege ich die Maus immer. Auch den Stuhl.',
  'Ich weine nicht nach Niederlagen. Meine Augen schwitzen. Aus Konzentration.',
  'Mein Rating ist ein Fehler im System. Das System weiß es. Es hat nur Angst.',
  'Die Uhr ist schuld. Sie läuft nur bei mir zu schnell.',
  'Ein echter Big Dog sagt nie ‚Das war mein Fehler‘. Er sagt: ‚Die Stellung war unfair.‘',
  'Ich habe keine Schwächen. Nur Stellungen, die mich nicht verdient haben.',
  'Mein Selbstvertrauen hat 2800 Elo. Mein Rating wollen wir nicht erwähnen.',
  'Wenn ich eine Figur einstelle, ist das ein Opfer. Wenn du eine einstellst, ist das ein Fehler. So ist das Gesetz.',
  'Verlorene Partien lösche ich aus dem Verlauf. Deshalb bin ich ungeschlagen.',
  'Ich spiele nicht schlecht. Ich spiele ehrlich. Die Eröffnungstheorie hat damit ein Problem.',
  // Grindset
  'Meine Morgenroutine: kalt duschen, drei Eier, 1.e4. Der Rest ist Weichspüler.',
  'Kalt duschen, um vier aufstehen, Endspiele studieren. Ich habe nur die ersten beiden geschafft.',
  'Ich schlafe nicht. Ich spiele um drei Uhr nachts Bullet. Mein Rating schläft auch nicht: Es sinkt.',
  'Sonnenbrille am Brett ist keine Mode, sondern Haltung. Ich sehe nichts, aber mit Haltung.',
  'Ich brauche keine Freunde. Ich habe vierzehn Rematches pro Abend mit demselben Fremden.',
  'Big Dogs reden nicht über Gefühle. Sie schreiben ‚gg‘ und gehen in den Keller.',
  'Cheems hat Angst. Ich habe auch Angst. Ich habe nur eine Sonnenbrille.',
  // Schach-Jargon und Haltung
  'Ich spiele immer 1.e4. 1.d4 ist für Leute, die Pläne mögen.',
  'Ich spiele keinen Sizilianer. Ich spiele ‚Sizilianer-Killer‘. Ich weiß nicht, was das ist, aber es klingt tödlich.',
  'Meine Bauernstruktur ist wie mein Oberkörper: breit, steif und von hinten schwach.',
  'Rochade ist Feigheit. Mein König bleibt in der Mitte und macht Smalltalk.',
  'Abzugsschach heißt: Ich haue ab, und du hast den Ärger. Ich nenne das Männlichkeit.',
  'Echte Männer opfern keine Dame. Sie stellen sie ein und nennen es Strategie.',
  'Ich habe Dame, Turm und Läufer geopfert. Übrig bleiben Haltung und ein Bauer auf a2.',
  // Online-Kultur
  'Nach jedem Sieg schreibe ich ‚ez‘. Nach jeder Niederlage ‚lag‘. Das nennt man Konsequenz.',
  'Ich rufe beim Online-Spielen laut ‚Schach!‘. Meine Nachbarn kennen mein Rating.',
  'Wenn mein Gegner eine Figur einstellt, schaue ich ihn über die Webcam stumm an, bis er aufgibt. Ich habe keine Webcam.',
  'Ich habe einen Hund, der Schach spielt. Ich führe 7:0. Er sagt, er lässt mich gewinnen, weil ich sonst weine.',
  // Derb
  'Ich lege meinen König nie um. Höchstens das Brett.',
  'Ich habe die dickeren Eier und die schlechtere Eröffnung. Beides macht sich bemerkbar.',
  'Er hat mehr Elo, ich habe die größere Klappe. Entschieden wird am Brett. Deshalb verliere ich.',
];

/** So lange mindestens anzeigen (Millisekunden): kurze Sprüche 2,8 s, lange bis 4 s, damit man sie in Ruhe lesen kann. */
export function readTimeMs(text: string): number {
  return Math.min(4000, Math.max(2800, 1200 + text.length * 28));
}

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
