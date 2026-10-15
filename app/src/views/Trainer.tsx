import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import type { Role, SquareName } from 'chessops/types';
import { destsOf, isPromotion, positionOf, sanOfMove, uciSquares, walkVariation } from '../lib/chess';
import { explain, sideName } from '../lib/explain';
import { dateLabel, dayKey, inWords, n0, n1, pct, seconds } from '../lib/format';
import { gradeFor, judge, type Judgement } from '../lib/judge';
import { counts, pickNext, type PickKind } from '../lib/queue';
import { applyReview, dueDate } from '../lib/srs';
import { getState, update, useAppState } from '../lib/store';
import { today } from '../lib/stats';
import type { Exercise, Grade, ReviewEntry, Verdict } from '../lib/types';

interface Props {
  exercises: Exercise[];
  onExit: () => void;
}

interface Result {
  verdict: Verdict;
  judgement: Judgement | null;
  san: string | null;
  ms: number;
  grade: Grade;
  nextDue: Date;
  ts: number;
}

const PROMOTION_ROLES: { role: Role; label: string }[] = [
  { role: 'queen', label: 'Dame' },
  { role: 'rook', label: 'Turm' },
  { role: 'bishop', label: 'Läufer' },
  { role: 'knight', label: 'Springer' },
];

const VERDICT_TEXT: Record<Verdict, string> = {
  best: 'Richtig',
  equal: 'Richtig, gleichwertiger Zug',
  playable: 'Spielbar, aber schwächer',
  wrong: 'Falsch',
  gaveup: 'Lösung angezeigt',
};

const KIND_TEXT: Record<PickKind, string> = { due: 'Wiederholung', learning: 'Lernschritt', new: 'Neu' };

function shape(orig: SquareName, dest: SquareName, brush: string): DrawShape {
  return { orig: orig as Key, dest: dest as Key, brush };
}

export function Trainer({ exercises, onExit }: Props) {
  const state = useAppState();
  const settings = state.settings;

  const [current, setCurrent] = useState<{ ex: Exercise; kind: PickKind } | null>(null);
  const [phase, setPhase] = useState<'ask' | 'result'>('ask');
  const [result, setResult] = useState<Result | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [promo, setPromo] = useState<{ orig: SquareName; dest: SquareName } | null>(null);
  const [pv, setPv] = useState<{ line: number; step: number } | null>(null);
  const [finished, setFinished] = useState(false);

  const boardEl = useRef<HTMLDivElement>(null);
  const cg = useRef<Api | null>(null);
  const shownAt = useRef(0);
  const shownWall = useRef(0);
  const lastShown = useRef<{ id: string; cat: string } | undefined>(undefined);
  const curRef = useRef<Exercise | null>(null);
  const phaseRef = useRef<'ask' | 'result'>('ask');
  const resultShapes = useRef<DrawShape[]>([]);

  phaseRef.current = phase;
  curRef.current = current?.ex ?? null;

  // Bildschirm anlassen, solange trainiert wird
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        lock = (await nav.wakeLock?.request('screen')) ?? null;
      } catch {
        // optional
      }
    };
    void request();
    const onVis = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release();
    };
  }, []);

  const loadNext = useCallback(() => {
    const next = pickNext(exercises, getState(), new Date(), lastShown.current);
    setPv(null);
    setPromo(null);
    setResult(null);
    setPhase('ask');
    setElapsed(0);
    if (!next) {
      setCurrent(null);
      setFinished(true);
      return;
    }
    lastShown.current = { id: next.ex.id, cat: next.ex.cat };
    setFinished(false);
    setCurrent(next);
  }, [exercises]);

  useEffect(() => {
    loadNext();
    return () => cg.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Brett aufbauen bzw. neue Aufgabe setzen
  useEffect(() => {
    const ex = current?.ex;
    if (!ex || !boardEl.current) return;
    const pos = positionOf(ex.fen);
    const color = ex.turn === 'w' ? 'white' : 'black';
    const config = {
      fen: ex.fen,
      orientation: color,
      turnColor: color,
      check: pos.isCheck(),
      lastMove: undefined,
      coordinates: true,
      blockTouchScroll: true,
      animation: { enabled: true, duration: 150 },
      highlight: { lastMove: true, check: true },
      draggable: { enabled: true, showGhost: true },
      selectable: { enabled: true },
      premovable: { enabled: false },
      drawable: { enabled: true, visible: true, autoShapes: [] as DrawShape[] },
      movable: {
        free: false,
        color,
        dests: destsOf(pos) as never,
        showDests: true,
        events: { after: (orig: Key, dest: Key) => onUserMove(orig as SquareName, dest as SquareName) },
      },
    } as const;
    if (!cg.current) {
      cg.current = Chessground(boardEl.current, config as never);
    } else {
      cg.current.set(config as never);
    }
    resultShapes.current = [];
    shownAt.current = performance.now();
    shownWall.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Zeitanzeige
  useEffect(() => {
    if (phase !== 'ask' || !current) return;
    const id = window.setInterval(() => setElapsed(performance.now() - shownAt.current), 100);
    return () => window.clearInterval(id);
  }, [phase, current]);

  const lockBoard = () => {
    cg.current?.set({ movable: { color: undefined, dests: new Map() } as never, draggable: { enabled: false } });
  };

  const showShapes = (shapes: DrawShape[], resetFen?: string) => {
    resultShapes.current = shapes;
    cg.current?.set({ ...(resetFen ? { fen: resetFen, lastMove: undefined } : {}), drawable: { autoShapes: shapes } } as never);
  };

  const record = (ex: Exercise, verdict: Verdict, grade: Grade, ms: number, san: string | null, judgement: Judgement | null) => {
    const now = new Date();
    const rec = applyReview(getState().cards[ex.id], grade, now);
    const entry: ReviewEntry = { id: ex.id, ts: now.getTime(), grade, verdict, ms, dur: ms, san: san ?? undefined };
    update((s) => ({ ...s, cards: { ...s.cards, [ex.id]: rec }, log: [...s.log, entry] }));
    setResult({ verdict, judgement, san, ms, grade, nextDue: dueDate(rec), ts: entry.ts });
    setPhase('result');
    lockBoard();
  };

  const finishMove = (orig: SquareName, dest: SquareName, role?: Role) => {
    const ex = curRef.current;
    if (!ex || phaseRef.current !== 'ask') return;
    const pos = positionOf(ex.fen);
    const san = sanOfMove(pos, orig, dest, role);
    if (!san) {
      cg.current?.set({ fen: ex.fen } as never);
      return;
    }
    const ms = Math.round(performance.now() - shownAt.current);
    const j = judge(ex, san, getState().settings.tolerance);
    const grade = gradeFor(j.correct, ms, getState().settings.timeLimit);
    const best = ex.lines[0];
    const shapes: DrawShape[] = [];
    const [bf, bt] = uciSquares(best.uci);
    if (j.verdict !== 'best') shapes.push(shape(bf, bt, 'green'));
    if (!j.correct) shapes.push(shape(orig, dest, j.verdict === 'playable' ? 'yellow' : 'red'));
    record(ex, j.verdict, grade, ms, san, j);
    if (j.correct) showShapes(shapes);
    else showShapes(shapes, ex.fen);
  };

  const onUserMove = (orig: SquareName, dest: SquareName) => {
    const ex = curRef.current;
    if (!ex || phaseRef.current !== 'ask') return;
    const pos = positionOf(ex.fen);
    if (isPromotion(pos, orig, dest)) {
      setPromo({ orig, dest });
      return;
    }
    finishMove(orig, dest);
  };

  const choosePromotion = (role: Role) => {
    if (!promo) return;
    const p = promo;
    setPromo(null);
    finishMove(p.orig, p.dest, role);
  };

  const giveUp = () => {
    const ex = curRef.current;
    if (!ex || phase !== 'ask') return;
    const ms = Math.round(performance.now() - shownAt.current);
    const [bf, bt] = uciSquares(ex.lines[0].uci);
    record(ex, 'gaveup', 1, ms, null, null);
    showShapes([shape(bf, bt, 'green')], ex.fen);
  };

  const hideAndNext = () => {
    const ex = curRef.current;
    if (ex) update((s) => ({ ...s, hidden: { ...s.hidden, [ex.id]: { on: true, ts: Date.now() } } }));
    next();
  };

  const next = () => {
    const r = result;
    const ex = current?.ex;
    if (r && ex) {
      const dur = Math.min(180000, Date.now() - shownWall.current);
      update((s) => ({
        ...s,
        log: s.log.map((e) => (e.id === ex.id && e.ts === r.ts ? { ...e, dur } : e)),
      }));
    }
    loadNext();
  };

  // Varianten ansehen
  const steps = useMemo(() => {
    if (!pv || !current) return null;
    return walkVariation(current.ex.fen, current.ex.lines[pv.line].pv);
  }, [pv?.line, current]);

  useEffect(() => {
    if (!cg.current || !current) return;
    if (pv && steps) {
      const st = steps[Math.min(pv.step, steps.length - 1)];
      cg.current.set({ fen: st.fen, lastMove: st.lastMove as never, drawable: { autoShapes: [] } } as never);
    } else if (phase === 'result') {
      cg.current.set({ fen: current.ex.fen, lastMove: undefined, drawable: { autoShapes: resultShapes.current } } as never);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pv?.line, pv?.step]);

  const ex = current?.ex ?? null;
  const limit = settings.timeLimit;
  const c = counts(exercises, state, new Date());
  const t = today(state.log, new Date());
  const explanation = ex ? explain(ex) : [];
  const over = limit > 0 && elapsed > limit * 1000;
  const barPct = limit > 0 ? Math.min(100, (elapsed / (limit * 1000)) * 100) : 0;

  if (finished || !ex) {
    return (
      <section class="screen">
        <header class="topbar">
          <button class="link" onClick={onExit}>
            ← Zurück
          </button>
        </header>
        <div class="card center">
          <h2>{c.total === 0 ? 'Keine Aufgaben im Filter' : 'Für heute ist alles erledigt'}</h2>
          <p class="muted">
            {c.total === 0
              ? 'Ändere den Filter in den Einstellungen.'
              : `Heute ${n0(t.n)} Aufgaben${t.rate !== null ? `, ${pct(t.rate)} richtig` : ''}. Neue Aufgaben kommen morgen, fällige Wiederholungen früher.`}
          </p>
          {c.total > 0 && c.newTotal > 0 && (
            <button
              class="btn secondary"
              onClick={() => {
                update((s) => {
                  const day = dayKey(Date.now());
                  const n = (s.bonus && s.bonus.day === day ? s.bonus.n : 0) + 5;
                  return { ...s, bonus: { day, n } };
                });
                loadNext();
              }}
            >
              5 weitere neue Aufgaben
            </button>
          )}
          <button class="btn" onClick={onExit}>
            Fertig
          </button>
        </div>
      </section>
    );
  }

  const best = ex.lines[0];
  const alts = ex.lines.slice(1).filter((l) => best.wp - l.wp <= 10);
  const correctNow = result && (result.verdict === 'best' || result.verdict === 'equal');
  const slow = result && correctNow && result.grade === 2;

  return (
    <section class="screen trainer">
      <header class="topbar">
        <button class="link" onClick={onExit} aria-label="Training beenden">
          ← Beenden
        </button>
        <div class="counts" aria-label="Warteschlange">
          <span title="fällig">{n0(c.due)} fällig</span>
          <span title="Lernschritte">{n0(c.learning)} lernen</span>
          <span title="neu heute">{n0(c.newAvailable)} neu</span>
        </div>
      </header>

      <div class="prompt">
        <span class={`side ${ex.turn}`}>{sideName(ex.turn)} am Zug</span>
        <span class="tag">{KIND_TEXT[current!.kind]}</span>
        <span class="tag">{ex.phase}</span>
      </div>

      <div class="board-wrap">
        <div ref={boardEl} class="board" role="img" aria-label={`Schachstellung, ${sideName(ex.turn)} am Zug`} />
        {promo && (
          <div class="promo" role="dialog" aria-label="Umwandlung wählen">
            {PROMOTION_ROLES.map((p) => (
              <button class="btn secondary" key={p.role} onClick={() => choosePromotion(p.role)}>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {phase === 'ask' && (
        <div class="timer" aria-live="off">
          <div class={`bar ${over ? 'over' : ''}`}>
            <i style={{ width: limit > 0 ? `${barPct}%` : '0%' }} />
          </div>
          <span class="mono">
            {n1(elapsed / 1000)} s{limit > 0 ? ` von ${n0(limit)} s` : ''}
          </span>
        </div>
      )}

      {phase === 'ask' && (
        <div class="actions ask">
          <p class="muted small">Finde den besten Zug. Tippe Figur und Zielfeld oder zieh die Figur.</p>
          <button class="btn secondary" onClick={giveUp}>
            Lösung zeigen
          </button>
        </div>
      )}

      {phase === 'result' && result && (
        <div class="result" role="status" aria-live="polite">
          <div class="verdict-row">
            <span class={`chip ${correctNow ? (slow ? 'warn' : 'good') : result.verdict === 'playable' ? 'warn' : 'bad'}`}>
              {slow ? 'Richtig, aber zu langsam' : VERDICT_TEXT[result.verdict]}
            </span>
            <span class="mono muted">{seconds(result.ms)}</span>
          </div>

          {result.san && (
            <p>
              Dein Zug: <b class="mono">{result.san}</b>
              {result.judgement && result.judgement.lossWp !== null
                ? ` · ${n0(ex.lines[result.judgement.rank ?? 0].wp)} % Gewinnchance`
                : ' · nicht unter den fünf besten Zügen'}
            </p>
          )}
          <p>
            Bester Zug: <b class="mono good-text">{best.san}</b> · {n0(best.wp)} % Gewinnchance
            {alts.length > 0 && (
              <span class="muted">
                {' '}
                · gleichwertig: {alts.map((a) => a.san).join(', ')}
              </span>
            )}
          </p>
          <p class="muted">
            In der Partie gespielt: <span class="mono">{ex.played.san}</span> ({n0(ex.played.wp)} %, {n0(ex.loss)} Punkte weniger als der
            beste Zug).
          </p>

          <ul class="why">
            {explanation.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>

          <p class="muted small">
            Nächste Wiederholung {inWords(new Date(), result.nextDue)}. Partie vom {dateLabel(ex.date)}.
          </p>

          {pv && steps ? (
            <div class="pv">
              <div class="pv-moves mono">
                {ex.lines[pv.line].pv.slice(0, steps.length - 1).map((m, i) => (
                  <button key={i} class={`pv-move ${i + 1 === pv.step ? 'on' : ''}`} onClick={() => setPv({ line: pv.line, step: i + 1 })}>
                    {m}
                  </button>
                ))}
              </div>
              <div class="pv-controls">
                <button class="btn secondary" disabled={pv.step <= 0} onClick={() => setPv({ line: pv.line, step: pv.step - 1 })} aria-label="Ein Zug zurück">
                  ◀
                </button>
                <button
                  class="btn secondary"
                  disabled={pv.step >= steps.length - 1}
                  onClick={() => setPv({ line: pv.line, step: pv.step + 1 })}
                  aria-label="Ein Zug vor"
                >
                  ▶
                </button>
                <button class="btn secondary" onClick={() => setPv(null)}>
                  Variante schließen
                </button>
              </div>
            </div>
          ) : (
            <div class="actions row">
              <button class="btn secondary" onClick={() => setPv({ line: 0, step: 0 })}>
                Variante ansehen
              </button>
              <a class="btn secondary" href={ex.url} target="_blank" rel="noopener noreferrer">
                Partie ansehen
              </a>
            </div>
          )}

          <button class="btn" onClick={next}>
            Weiter
          </button>
          <button class="link muted" onClick={hideAndNext}>
            Diese Aufgabe nicht mehr zeigen
          </button>
        </div>
      )}
    </section>
  );
}
