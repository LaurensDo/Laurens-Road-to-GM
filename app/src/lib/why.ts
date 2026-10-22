import { numberedMoves } from './variation';
import type { Exercise } from './types';

/** Fehlerarten, bei denen du selbst etwas eingestellt oder übersehen hast */
const BLUNDER = new Set(['Figur eingestellt', 'Gegnerische Taktik übersehen', 'Matt übersehen']);

/** Taktische Motive zuerst, allgemeine ("Stiller Zug", "Verteidigungszug") zuletzt */
const GENERAL = new Set(['Stiller Zug', 'Verteidigungszug', 'Vorgerückter Bauer', 'Königsangriff', 'Ungeschützter König']);

/**
 * Die Zeile "Idee" zum besten Zug: Motiv und was die Linie bringt. Ohne beides beim Fehler-Training ehrlich: keine schnelle Taktik.
 * null, wenn die Übung keine Angaben hat (ältere Daten) oder bei "Sicher gewinnen" (dort zählt Tempo, nicht der beste Zug).
 */
export function ideaText(ex: Exercise): string | null {
  if (ex.win) return null;
  const w = ex.why;
  const tags = w ? [...w.tags.filter((t) => !GENERAL.has(t)), ...w.tags.filter((t) => GENERAL.has(t))] : [];
  const parts: string[] = [];
  if (tags.length) parts.push(`${tags.slice(0, 3).join(', ')}.`);
  const g = w?.gain;
  if (g?.mate) parts.push(`Matt in ${g.mate}: ${numberedMoves(ex.fen, g.line).join(' ')}.`);
  else if (g?.words) parts.push(`Nach ${numberedMoves(ex.fen, g.line).join(' ')} gewinnst du ${g.words}.`);
  if (!parts.length) {
    if (ex.tb || !w) return null;
    // Bei eigenen Patzern ist die Lehre "nichts einstellen", nicht "Stellung": Der beste Zug hält, was der Fehler hergab
    if (BLUNDER.has(ex.cat)) {
      return `Keine eigene Taktik: Wichtig ist, nichts einzustellen.${ex.threat ? ` Der Gegner droht ${ex.threat.san}.` : ''}`;
    }
    return 'Keine schnelle Taktik: Der Zug hält die Stellung, das Material bleibt gleich. Hier geht es um die Stellung, nicht um eine Figur.';
  }
  return parts.join(' ');
}

/** Was ein Fehlzug kostet: "Nach 23.Lxf7 folgt Kxf7 24.Sg5+ Kg8, und du verlierst einen Läufer." null, wenn dazu nichts gespeichert ist. */
export function costText(ex: Exercise, san: string): string | null {
  const a = ex.why?.against.find((x) => x[0] === san)?.[1];
  if (!a) return null;
  const line = numberedMoves(ex.fen, [san, ...a.line]);
  const head = `Nach ${line[0]} folgt ${line.slice(1).join(' ')}`;
  return a.mate ? `${head}, und du wirst mattgesetzt.` : `${head}, und du verlierst ${a.words}.`;
}
