// Nachbau von chess.com- und lichess-Abrufen für die Tests: Playwright beantwortet die Anfragen, es geht nichts ins Netz.
// Die Partien sind erfunden (Springer hin und her), ohne echte Namen.
const SHUFFLE = ['Nc3', 'Nc6', 'Nb1', 'Nb8'];
const CORS = { 'access-control-allow-origin': '*' };

function fmt(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}

/** Eine Partie: n Züge je Seite, Zeit je Zug eigene und gegnerische (Funktionen der Zugnummer) */
export function gameLine(n, spentMine = () => 3, spentOpp = () => 3, color = 'w', base = 180, inc = 0) {
  const sans = [];
  while (sans.length < 2 * n) sans.push(SHUFFLE[sans.length % 4]);
  const left = [base, base];
  const clk = sans.map((_, i) => {
    const mine = (i % 2 === 0) === (color === 'w');
    const k = Math.floor(i / 2) + 1;
    const side = i % 2;
    left[side] = left[side] - (mine ? spentMine(k) : spentOpp(k)) + inc;
    return left[side];
  });
  return { sans, clk };
}

export function chesscomGame({ id, end, color = 'w', mine = 'win', theirs = 'resigned', n = 35, spentMine, spentOpp, tc = '180' }) {
  const [base, inc] = tc.split('+').map(Number);
  const { sans, clk } = gameLine(n, spentMine, spentOpp, color, base, inc ?? 0);
  const pgn =
    `[Event "Live Chess"]\n[White "x"]\n[Black "y"]\n\n` +
    sans.map((s, i) => `${i % 2 === 0 ? `${i / 2 + 1}. ` : `${Math.floor(i / 2) + 1}... `}${s} {[%clk ${fmt(clk[i])}]}`).join(' ') +
    ' 1-0';
  const me = { username: 'Laurens3495', result: mine };
  const opp = { username: 'Gegner', result: theirs };
  return { url: `https://www.chess.com/game/live/${id}`, uuid: `u${id}`, pgn, time_control: tc, end_time: Math.floor(end / 1000), rules: 'chess', time_class: 'blitz', white: color === 'w' ? me : opp, black: color === 'w' ? opp : me };
}

export function lichessGame({ id, end, color = 'w', winner = 'white', status = 'outoftime', n = 30, spentMine, spentOpp }) {
  const { sans, clk } = gameLine(n, spentMine, spentOpp, color, 60, 0);
  const me = { user: { name: 'Poquitonator' } };
  const opp = { user: { name: 'Gegner' } };
  return JSON.stringify({ id, variant: 'standard', speed: 'bullet', status, winner, lastMoveAt: end, moves: sans.join(' '), clocks: clk.map((c) => Math.round(c * 100)), clock: { initial: 60, increment: 0 }, players: color === 'w' ? { white: me, black: opp } : { white: opp, black: me } });
}

/**
 * Beantwortet die Abrufe. `chesscom`: Liste von Partien (pro Monat dieselbe Antwort), `lichess`: Zeilen.
 * `mode`: 'ok', 'error' (500) oder 'offline' (Verbindung scheitert). Zählt die Anfragen.
 */
export async function mockGames(ctx, { chesscom = [], lichess = [], mode = 'ok' } = {}) {
  const calls = { chesscom: 0, lichess: 0 };
  await ctx.route('https://api.chess.com/**', (r) => {
    calls.chesscom++;
    if (mode === 'offline') return r.abort('internetdisconnected');
    if (mode === 'error') return r.fulfill({ status: 500, headers: CORS, body: '{}' });
    return r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ games: chesscom }) });
  });
  await ctx.route('https://lichess.org/api/**', (r) => {
    calls.lichess++;
    if (mode === 'offline') return r.abort('internetdisconnected');
    if (mode === 'error') return r.fulfill({ status: 500, headers: CORS, body: '{}' });
    return r.fulfill({ status: 200, headers: CORS, contentType: 'application/x-ndjson', body: lichess.join('\n') });
  });
  return calls;
}
