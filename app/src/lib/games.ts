import { Chess } from 'chessops/chess';
import { parseSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';

/**
 * Eigene Partien von chess.com und lichess: Zeitpunkt, Zeitmodus, Farbe, Ergebnis, Züge (SAN) und die Uhr nach jedem Halbzug.
 * Keine Namen und keine Wertungen von Gegnern, nur was für die Uhr-Auswertung nötig ist. Liegt nur auf dem Gerät (nicht im Abgleich),
 * jedes Gerät holt sich die Partien selbst.
 */

export type Src = 'chesscom' | 'lichess';

export interface GameRec {
  /** "cc:<id>" oder "li:<id>" */
  id: string;
  src: Src;
  url: string;
  /** Ende der Partie (ms) */
  end: number;
  base: number;
  inc: number;
  color: 'w' | 'b';
  /** aus deiner Sicht: gewonnen, verloren, remis */
  result: 'w' | 'l' | 'd';
  /** deine Zeit ist abgelaufen / die des Gegners */
  timeLoss: boolean;
  timeWin: boolean;
  sans: string[];
  /** Restzeit (Sekunden) des Ziehenden nach jedem Halbzug */
  clk: number[];
  /** Materialbilanz (Weiß minus Schwarz, Bauerneinheiten) nach jedem Halbzug; leer, wenn die Züge nicht lesbar waren */
  mat: number[];
}

/** Zeitmodus als Text, z. B. "3+0" */
export const tcOf = (g: Pick<GameRec, 'base' | 'inc'>): string => `${g.base / 60}+${g.inc}`;

const VALUE: Record<string, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };

/** Materialbilanz nach jedem Halbzug (Weiß minus Schwarz). null, wenn ein Zug nicht lesbar ist. */
export function materialTrack(sans: string[]): number[] | null {
  const pos = Chess.default();
  const out: number[] = [];
  for (const san of sans) {
    const mv = parseSan(pos, san);
    if (!mv) return null;
    pos.play(mv);
    let bal = 0;
    for (const [, p] of pos.board) bal += (p.color === 'white' ? 1 : -1) * (VALUE[p.role] ?? 0);
    out.push(bal);
  }
  return out;
}

/** Stellung (FEN) nach den ersten `plies` Halbzügen, für das kleine Brett. null, wenn ein Zug nicht lesbar ist. */
export function fenAfter(sans: string[], plies: number): string | null {
  const pos = Chess.default();
  for (const san of sans.slice(0, plies)) {
    const mv = parseSan(pos, san);
    if (!mv) return null;
    pos.play(mv);
  }
  return makeFen(pos.toSetup());
}

const clean = (g: Omit<GameRec, 'mat'>): GameRec | null => {
  if (g.sans.length < 4 || g.clk.length !== g.sans.length) return null;
  if (!(g.base > 0)) return null;
  return { ...g, mat: materialTrack(g.sans) ?? [] };
};

// ---- chess.com: Monatsarchiv https://api.chess.com/pub/player/<name>/games/<jahr>/<monat>

interface ChessComGame {
  url?: string;
  pgn?: string;
  time_control?: string;
  end_time?: number;
  rules?: string;
  time_class?: string;
  uuid?: string;
  white?: { username?: string; result?: string };
  black?: { username?: string; result?: string };
}

const DRAWN = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', 'timevsinsufficient', '50move']);

/** Züge und Uhr aus dem PGN-Text von chess.com ("1. e4 {[%clk 0:02:59.9]} 1... c5 {[%clk …]}"). */
export function parseChessComPgn(pgn: string): { sans: string[]; clk: number[] } {
  const body = pgn.includes('\n\n') ? pgn.slice(pgn.indexOf('\n\n') + 2) : pgn;
  const sans: string[] = [];
  const clk: number[] = [];
  const re = /(?:\d+\.+\s*)?([KQRBNOa-h][A-Za-z0-9=+#x\-]*)\s*\{\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]\}/g;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    sans.push(m[1]);
    clk.push(Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4]));
  }
  return { sans, clk };
}

export function parseChessComArchive(json: unknown, me: string): GameRec[] {
  const list = (json as { games?: ChessComGame[] } | null)?.games;
  if (!Array.isArray(list)) return [];
  const out: GameRec[] = [];
  for (const g of list) {
    if (g.rules !== 'chess' || !g.pgn || !g.end_time || !g.url) continue;
    if (g.time_class !== 'bullet' && g.time_class !== 'blitz') continue;
    const [b, i] = String(g.time_control ?? '').split('+');
    const base = Number(b);
    const inc = Number(i ?? 0);
    const white = g.white?.username?.toLowerCase() === me.toLowerCase();
    const black = g.black?.username?.toLowerCase() === me.toLowerCase();
    if (!white && !black) continue;
    const mine = (white ? g.white : g.black)?.result ?? '';
    const theirs = (white ? g.black : g.white)?.result ?? '';
    const { sans, clk } = parseChessComPgn(g.pgn);
    const rec = clean({
      id: `cc:${g.uuid ?? g.url.split('/').pop()}`,
      src: 'chesscom',
      url: g.url,
      end: g.end_time * 1000,
      base,
      inc,
      color: white ? 'w' : 'b',
      result: mine === 'win' ? 'w' : DRAWN.has(mine) ? 'd' : 'l',
      timeLoss: mine === 'timeout',
      timeWin: theirs === 'timeout',
      sans,
      clk,
    });
    if (rec) out.push(rec);
  }
  return out;
}

// ---- lichess: NDJSON von /api/games/user/<name> (mit clocks=true)

interface LichessGame {
  id?: string;
  variant?: string;
  speed?: string;
  status?: string;
  winner?: 'white' | 'black';
  lastMoveAt?: number;
  createdAt?: number;
  moves?: string;
  clocks?: number[];
  clock?: { initial?: number; increment?: number };
  players?: { white?: { user?: { name?: string } }; black?: { user?: { name?: string } } };
}

export function parseLichessNdjson(text: string, me: string): GameRec[] {
  const out: GameRec[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let g: LichessGame;
    try {
      g = JSON.parse(line) as LichessGame;
    } catch {
      continue;
    }
    if (g.variant !== 'standard' || !g.id || !g.moves || !g.clocks || !g.clock) continue;
    if (g.speed !== 'bullet' && g.speed !== 'blitz') continue;
    if (g.status === 'aborted' || g.status === 'noStart') continue;
    const white = g.players?.white?.user?.name?.toLowerCase() === me.toLowerCase();
    const black = g.players?.black?.user?.name?.toLowerCase() === me.toLowerCase();
    if (!white && !black) continue;
    const myColor = white ? 'white' : 'black';
    const sans = g.moves.split(' ').filter(Boolean);
    const rec = clean({
      id: `li:${g.id}`,
      src: 'lichess',
      url: `https://lichess.org/${g.id}`,
      end: g.lastMoveAt ?? g.createdAt ?? 0,
      base: g.clock.initial ?? 0,
      inc: g.clock.increment ?? 0,
      color: white ? 'w' : 'b',
      result: !g.winner ? 'd' : g.winner === myColor ? 'w' : 'l',
      timeLoss: g.status === 'outoftime' && !!g.winner && g.winner !== myColor,
      timeWin: g.status === 'outoftime' && g.winner === myColor,
      sans,
      clk: g.clocks.map((c) => c / 100),
    });
    if (rec) out.push(rec);
  }
  return out;
}
