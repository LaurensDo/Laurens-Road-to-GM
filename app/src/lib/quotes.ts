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
  // Derb
  'Ich lege meinen König nie um. Höchstens das Brett.',
  'Ich habe die dickeren Eier und die schlechtere Eröffnung. Beides macht sich bemerkbar.',
  'Er hat mehr Elo, ich habe die größere Klappe. Entschieden wird am Brett. Deshalb verliere ich.',
  'Remis angeboten? Ich antworte mit dem Blick, den mein Vater für meine Zeugnisse hatte.',
  'Wer mir im Blitz die Zeit klaut, kriegt auf die Fresse. Virtuell. Per Chat. Mit drei Ausrufezeichen.',
  'Mein Gegner hat meine Gabel gesehen. Dieses Arschloch hat tatsächlich aufgepasst.',
  'Ich verliere mit Würde. Ich schreie erst im Auto.',
  'Mein Gegner hat Drohungen. Ich habe Eier. Das Brett interessiert sich nur für die Drohungen.',
  'Ich spiele Bullet, bis meine Finger bluten oder meine Mutter ruft. Meistens ruft sie.',
  'Gestern 60 Bullet-Partien: 59 verloren, eine Remis. Ich nenne das Aufwärtstrend.',
  'Ich kaufe keine Schachbücher, ich kaufe Proteinpulver. Für die Bauern.',
  'Ich habe mehr Testosteron als Eröffnungswissen. Beides sieht man, und beides hilft nicht.',
  'Ich greife an, bis der Gegner weint. Meistens bin ich das.',
  'Mein König bleibt in der Mitte, weil er sich vor nichts fürchtet. Er wird gleich sehr überrascht sein.',
  'Scheiß auf Theorie, scheiß auf Remis, scheiß auf die Uhr. Leider hat die Uhr auf mich geschissen.',
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

/**
 * Sprüche für die Ergebnisseite, je Lage ein Topf. Big Dog spottet nur über sich, nie über dich. Ein Spruch erscheint höchstens auf jeder
 * zweiten Ergebnisseite, die sachliche Zeile steht gleich groß daneben (setend.ts).
 */
export type Pot = 'geknackt' | 'dritterFehler' | 'perfekt' | 'rueckkehr' | 'vorschnell' | 'langsam' | 'schwer';

export const POTS: Record<Pot, string[]> = {
  // ein Dauerbrenner endlich richtig und in der Zeit
  geknackt: [
    'Endlich geknackt. Für meine Lieblingsstellung habe ich vier Jahre gebraucht. Dann habe ich den Zug wieder vergessen.',
    'Die Stellung, die dich dreimal erwischt hat, liegt jetzt am Boden. Ich übernehme das Posieren.',
    'Dauerbrenner erledigt. Ich erledige meine, indem ich sie aus dem Verlauf lösche.',
    'Endlich in der Zeit. Ich nenne so etwas Durchbruch. Beim nächsten Mal nenne ich es Talent.',
    'Dreimal daneben, jetzt mitten rein. So sehen Comebacks aus. Meine sehen anders aus.',
    'Die Stellung hat aufgegeben. Ich wünschte, meine Gegner wären so einsichtig.',
    'Gelernt ist gelernt. Ich habe das mal gehört und für eine Legende gehalten.',
    'Erst dreimal falsch, dann richtig und schnell. Bei mir läuft es meistens andersherum.',
    'Respekt. Ich klopfe dir anerkennend auf die Schulter. Sehr fest. Aus Gewohnheit.',
    'Dieser Fehler ist erledigt. Ich habe noch ein paar übrig, falls du welche brauchst.',
  ],
  // dieselbe Stellung zum dritten Mal falsch
  dritterFehler: [
    'Dieselbe Stellung zum dritten Mal falsch. Ich nenne das Treue.',
    'Dreimal dieselbe Stellung falsch. Ich spiele seit 2021 dieselbe verlorene Eröffnung. Konsequenz ist alles.',
    'Ein Big Dog gibt nicht auf. Er macht denselben Fehler so lange, bis die Stellung aufgibt.',
    'Diese Stellung und ich haben eine gemeinsame Geschichte. Eine traurige.',
    'Beim dritten Mal ist es kein Fehler mehr. Es ist eine Tradition.',
    'Ich habe einen Lieblingsfehler. Er hat mich auch lieb. Er kommt immer wieder.',
    'Diese Stellung kenne ich auswendig. Den falschen Zug auch.',
    'Ich lerne aus Fehlern. Deshalb mache ich sie so oft: Wiederholung ist die Mutter des Lernens.',
    'Ich ändere meinen Zug nicht, nur weil er falsch ist. Ich bin ein Mann mit Prinzipien.',
    'Der Zug ist nicht falsch. Die Stellung ist nur noch nicht bereit für ihn.',
  ],
  // alles richtig in einem vollen Satz
  perfekt: [
    'Alles richtig. So spiele ich auch. In meinen Träumen. Mit Weiß. Gegen meinen Hund.',
    'Fehlerfrei. Ich hatte auch mal so einen Satz. Dann habe ich weitergespielt.',
    'Perfekter Satz. Bei mir wäre jetzt der Moment, ein Remisangebot abzulehnen und alles zu verlieren.',
    'Null Fehler. Mein Rekord liegt bei einem Fehler. Pro Zug.',
    'So ein Satz verdient einen Brustschlag. Ich übernehme das, ich habe die Brust dafür.',
    'Makellos. Wie mein Selbstbild, nur mit Belegen.',
    'Alle richtig. Big Dog nickt anerkennend und tut so, als hätte er es kommen sehen.',
    'Perfekt. Ich mache jetzt Liegestütze, um mitzuhalten. Ich schaffe drei.',
    'Fehlerlos. Ich habe nichts zum Meckern gefunden. Das ärgert mich mehr als jede Niederlage.',
    'Alles richtig. Ich verlange eine Nachzählung. Aus Prinzip.',
  ],
  // erster Satz nach einer Pause von mehreren Tagen
  rueckkehr: [
    'Wieder da. Ich war auch weg: kalt duschen. Es hat drei Tage gedauert, bis ich mich getraut habe.',
    'Pause gemacht? Ich mache nie Pause. Ich spiele nur sehr selten Schach.',
    'Willkommen zurück. Meine längste Pause waren zwei Tage. Dann hat mein Rating mich vermisst und ist gefallen.',
    'Ein Big Dog kommt immer zurück. Meistens, weil er das Ladekabel vergessen hat.',
    'Pause ist keine Schwäche, Pause ist Regeneration. Das sage ich auch über die vier Wochen nach meinem letzten Turnier.',
    'Zurück nach der Pause. Ich habe in meiner Pause Muskeln aufgebaut. Am Daumen. Vom Scrollen.',
    'Wer Pausen macht, kommt ausgeruht zurück. Wer keine macht, so wie ich, spielt um drei Uhr nachts Bullet.',
    'Ein paar Tage weg und gleich wieder am Brett. Ich brauche nach einer Pause erst eine Pause von der Pause.',
    'Wieder da. Ich sage nach jeder Pause, dass ich jetzt richtig anfange. Seit 2019.',
    'Comeback. Ich hatte auch eins geplant, dann kam ein Remisangebot, und ich musste es ablehnen.',
  ],
  // mindestens zwei Fehler in unter drei Sekunden
  vorschnell: [
    'Ich ziehe immer sofort. Nachdenken ist was für Leute, die gewinnen wollen.',
    'Zwei Sekunden für einen Zug? Ich brauche eine. Die zweite brauche ich, um mir die Figur zurückzuwünschen.',
    'Ich sehe die Drohung immer. Meistens kurz nachdem ich gezogen habe.',
    'Mein erster Instinkt ist immer richtig. Mein zweiter Instinkt ist, das Brett umzudrehen.',
    'Big Dogs zögern nicht. Deshalb steht meine Dame so oft da, wo der Springer gerade hinzieht.',
    'Ich ziehe schneller, als ich denke. Für meine Gegner ist das ein großer Vorteil.',
    'Prüfen, was der Gegner droht? Ich lasse mich nicht bedrohen. Ich verliere lieber Material.',
    'Ich habe Reflexe wie eine Katze. Leider auch ihr Schachverständnis.',
    'Schach, Schlagen, Drohen prüfen? Ich prüfe nur, ob die Maus noch geht.',
    'Meine Hand war schon auf der Figur. Ein Big Dog nimmt nichts zurück. Auch keine Dame.',
  ],
  // mindestens zwei richtige Antworten, aber erst nach der Zielzeit
  langsam: [
    'Ich habe 20 Sekunden über einen Bauernzug nachgedacht. Der Bauer war beeindruckt. Die Uhr nicht.',
    'Ich finde immer den besten Zug. Meistens in der Partie danach.',
    'Ich lasse die Uhr laufen, damit der Gegner Angst bekommt. Er bekommt stattdessen Zeit.',
    'Gründlichkeit ist meine Stärke. Mein Fähnchen ist meine Schwäche.',
    'Ich rechne alles durch. Auch die Varianten, in denen der Gegner aufgibt. Er gibt nie auf.',
    'Der Zug war klar. Ich wollte nur sicher sein, dass er nach zwei Minuten immer noch richtig ist.',
    'Ich mache keine halben Sachen. Nur halbe Minuten auf der Uhr.',
    'Mein Zug war perfekt. Zu dem Zeitpunkt hatte ich noch vier Sekunden für den Rest der Partie.',
    'Ich habe den Gewinnzug gefunden und auf Zeit verloren. Moralisch war das ein Sieg.',
    'Ich vertraue meinem Bauchgefühl. Nachdem ich es eine Minute lang überprüft habe.',
  ],
  // weniger als 40 % richtig
  schwer: [
    'Schwere Runde. Ich nenne das Trainingsreiz. Mein Rating nennt es anders.',
    'Weniger als die Hälfte richtig. Bei mir heißt das: ein ganz normaler Dienstag.',
    'Echte Männer lernen aus Schmerz. Ich lerne seit 2021. Der Schmerz auch.',
    'Die Stellungen waren unfair. Ich weiß das, weil ich sie auch nicht gelöst hätte.',
    'Ich verliere nie. Entweder ich gewinne, oder ich sammle Material für die nächste Ausrede.',
    'Schlechter Satz? Ich hatte mal einen schlechten Monat. Er dauert noch an.',
    'Ein Big Dog fällt hin und steht wieder auf. Langsam. Mit Ächzen. Aber er steht auf.',
    'Heute nicht. Morgen vielleicht auch nicht. Aber irgendwann, und dann mit Sonnenbrille.',
    'Ich habe schon schlechter gespielt. Gestern zum Beispiel. Und vorgestern.',
    'Wer nie verliert, spielt zu leichte Gegner. Ich spiele seit Jahren nur zu schwere.',
  ],
};
