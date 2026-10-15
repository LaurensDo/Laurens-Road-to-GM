import { Chess, normalizeMove } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { chessgroundDests } from 'chessops/compat';
import { makeSan, parseSan } from 'chessops/san';
import { makeSquare, parseSquare, squareFile, squareRank } from 'chessops/util';
import type { NormalMove, Role, SquareName } from 'chessops/types';

export function positionOf(fen: string): Chess {
  const setup = parseFen(fen).unwrap();
  return Chess.fromSetup(setup).unwrap();
}

export function destsOf(pos: Chess): Map<SquareName, SquareName[]> {
  return chessgroundDests(pos);
}

export function isPromotion(pos: Chess, orig: SquareName, dest: SquareName): boolean {
  const from = parseSquare(orig);
  const to = parseSquare(dest);
  if (from === undefined || to === undefined) return false;
  const piece = pos.board.get(from);
  if (!piece || piece.role !== 'pawn') return false;
  const rank = squareRank(to);
  return rank === 0 || rank === 7;
}

/** SAN eines Zuges, den Chessground meldet (Rochade und Umwandlung eingeschlossen). null = unzulässig. */
export function sanOfMove(pos: Chess, orig: SquareName, dest: SquareName, promotion?: Role): string | null {
  const from = parseSquare(orig);
  const to = parseSquare(dest);
  if (from === undefined || to === undefined) return null;
  const move: NormalMove = { from, to, promotion };
  const norm = normalizeMove(pos, move);
  if (!pos.isLegal(norm)) return null;
  return makeSan(pos, norm);
}

export interface Step {
  fen: string;
  lastMove?: [SquareName, SquareName];
}

/** Stellungen entlang einer Variante in SAN. Index 0 = Ausgangsstellung. Bricht bei einem unlesbaren Zug ab. */
export function walkVariation(fen: string, sans: string[]): Step[] {
  const pos = positionOf(fen);
  const steps: Step[] = [{ fen: makeFen(pos.toSetup()) }];
  for (const san of sans) {
    const move = parseSan(pos, san);
    if (!move || !('from' in move)) break;
    pos.play(move);
    steps.push({ fen: makeFen(pos.toSetup()), lastMove: [makeSquare(move.from), makeSquare(move.to)] });
  }
  return steps;
}

/** "Nf3" -> Zielfeld-Paar für Pfeile: aus UCI des Engine-Zugs (e1g1 bleibt e1g1). */
export function uciSquares(uci: string): [SquareName, SquareName] {
  return [uci.slice(0, 2) as SquareName, uci.slice(2, 4) as SquareName];
}

/** Schlägt dieser Zug etwas (auch en passant)? Für den Ton, bevor die Umwandlung gewählt ist. */
export function isCapture(pos: Chess, orig: SquareName, dest: SquareName): boolean {
  const from = parseSquare(orig);
  const to = parseSquare(dest);
  if (from === undefined || to === undefined) return false;
  if (pos.board.has(to)) return true;
  const piece = pos.board.get(from);
  return !!piece && piece.role === 'pawn' && squareFile(from) !== squareFile(to);
}
