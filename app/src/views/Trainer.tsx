import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import type { Role, SquareName } from 'chessops/types';
import { destsOf, isCapture, isPromotion, lastSquares, positionOf, sanOfMove, uciSquares, walkVariation } from '../lib/chess';
import { explain, lastMoveLabel, sideName } from '../lib/explain';
import { count, dateLabel, dayKey, inWords, n0, n1, pct, seconds } from '../lib/format';
import { COVER_WP, equalMoves, gradeFor, isCorrect, judge, type Judgement } from '../lib/judge';
import { counts, pickNext, type PickKind } from '../lib/queue';
import { getPrefs } from '../lib/device';
import { listSets, loadActive, newSetId, rateOf, saveActive, summarize, type ActiveSet, type SetSummary } from '../lib/sets';
import { play, startCue, timerCue } from '../lib/sound';
import { applyReview, dueDate } from '../lib/srs';
import { getState, update, useAppState } from '../lib/store';
import { today } from '../lib/stats';
import { MAX_DUR_MS, type Exercise, type Grade, type ReviewEntry, type Verdict } from '../lib/types';
import { SetBar, SetResult } from './SetResult';

interface Props {
  exercises: Exercise[];
  byId: Map<string, Exercise>;
  /** Datenstand der Übungen, steht als dv an jeder Antwort */
  dataVersion: number;
  onExit: () => void;
}

interface Finished {
  s: SetSummary;
  entries: ReviewEntry[];
  moreAvailable: boolean;
}

function pointOf(e: Event): [number, number] | null {
  const t = e as TouchEvent;
  if (t.changedTouches && t.changedTouches.length) return [t.changedTouches[0].clientX, t.changedTouches[0].clientY];
  const m = e as MouseEvent;
  return typeof m.clientX === 'number' ? [m.clientX, m.clientY] : null;
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

/** Fehlerarten, bei denen eine Drohung des Gegners übersehen wurde (dort zeigt die App sie als Pfeil) */
const THREAT_CATS = new Set(['Figur eingestellt', 'Gegnerische Taktik übersehen', 'Matt übersehen']);

const KIND_TEXT: Record<PickKind, string> = { due: 'Wiederholung', learning: 'Lernschritt', new: 'Neu' };

/** Zeile zum eigenen Zug: Gewinnchance und Abstand zum besten, bei unbekannten Zügen ehrlich "deutlich schlechter". */
function yourMoveText(j: Judgement | null, complete: boolean): string {
  if (!j) return '';
  if (j.wp !== null && j.lossWp !== null) {
    const pts = Math.round(j.lossWp);
    return ` · ${n0(j.wp)} % Gewinnchance${pts >= 1 ? `, ${count(pts, 'Punkt', 'Punkte')} weniger als der beste` : ''}`;
  }
  return complete ? ` · deutlich schlechter (mehr als ${COVER_WP} Punkte weniger als der beste)` : ' · nicht unter den fünf besten Zügen';
}

function shape(orig: SquareName, dest: SquareName, brush: string): DrawShape {
  return { orig: orig as Key, dest: dest as Key, brush };
}

export function Trainer({ exercises, byId, dataVersion, onExit }: Props) {
  const state = useAppState();
  const settings = state.settings;

  const [current, setCurrent] = useState<{ ex: Exercise; kind: PickKind } | null>(null);
  const [phase, setPhase] = useState<'ask' | 'result'>('ask');
  const [result, setResult] = useState<Result | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [promo, setPromo] = useState<{ orig: SquareName; dest: SquareName } | null>(null);
  const [pv, setPv] = useState<{ line: number; step: number } | null>(null);
  const [finished, setFinished] = useState(false);
  const [setId, setSetId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Finished | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [live, setLive] = useState(false);
  /** läuft gerade die Widerlegung des eigenen Zuges auf dem Brett? */
  const [animating, setAnimating] = useState(false);

  const animTimers = useRef<number[]>([]);
  const animatingRef = useRef(false);
  const boardEl = useRef<HTMLDivElement>(null);
  const cg = useRef<Api | null>(null);
  const shownAt = useRef(0);
  const shownWall = useRef(0);
  const lastShown = useRef<{ id: string; cat: string } | undefined>(undefined);
  const curRef = useRef<Exercise | null>(null);
  const phaseRef = useRef<'ask' | 'result'>('ask');
  const resultShapes = useRef<DrawShape[]>([]);
  const activeRef = useRef<ActiveSet | null>(null);
  const durDone = useRef(false);
  const dragOrig = useRef<string | null>(null);
  const moved = useRef(false);
  const liveRef = useRef(false);

  phaseRef.current = phase;
  liveRef.current = live;
  curRef.current = current?.ex ?? null;

  const setEntries = useMemo(
    () => (setId ? state.log.filter((e) => e.set?.id === setId).sort((a, b) => a.ts - b.ts) : []),
    [state.log, setId],
  );
  const answered = setEntries.length;
  const setSize = activeRef.current?.size ?? settings.setSize;

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

  const destroyBoard = () => {
    cg.current?.destroy();
    cg.current = null;
  };

  const startSet = () => {
    const now = Date.now();
    const act: ActiveSet = { id: newSetId(now), startedAt: now, size: getState().settings.setSize, served: [] };
    activeRef.current = act;
    saveActive(act);
    setSetId(act.id);
    setSummary(null);
    setFinished(false);
  };

  const showSummary = () => {
    const act = activeRef.current;
    if (!act) return;
    const st = getState();
    const entries = st.log.filter((e) => e.set?.id === act.id).sort((a, b) => a.ts - b.ts);
    const previous = listSets(st.log)
      .filter((r) => r.id !== act.id && r.entries.length >= r.planned)
      .map(rateOf);
    const s = summarize(entries, act.size, byId, { limit: st.settings.timeLimit, previous, tolerance: st.settings.tolerance });
    const moreAvailable = !!pickNext(exercises, st, new Date());
    destroyBoard();
    saveActive(null);
    setCurrent(null);
    setResult(null);
    setPromo(null);
    setPv(null);
    setSummary({ s, entries, moreAvailable });
    play('done');
  };

  const loadNext = useCallback(() => {
    const act = activeRef.current;
    if (!act) return;
    const st = getState();
    const done = st.log.filter((e) => e.set?.id === act.id).length;
    durDone.current = false;
    setPv(null);
    setPromo(null);
    setResult(null);
    setPhase('ask');
    setElapsed(0);
    if (done >= act.size) {
      showSummary();
      return;
    }
    const next = pickNext(exercises, st, new Date(), lastShown.current, new Set(act.served));
    if (!next) {
      if (done > 0) {
        showSummary();
      } else {
        destroyBoard();
        setCurrent(null);
        setFinished(true);
      }
      return;
    }
    act.served.push(next.ex.id);
    saveActive(act);
    lastShown.current = { id: next.ex.id, cat: next.ex.cat };
    setLive(false);
    setFinished(false);
    setSummary(null);
    setCurrent(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, byId]);

  // Vor dem ersten Zeichnen: sonst steht für ein Bild "Für heute ist alles erledigt" da, bis die erste Aufgabe gewählt ist
  useLayoutEffect(() => {
    const st = getState();
    let act = loadActive();
    if (act) {
      const answeredIds = new Set(st.log.filter((e) => e.set?.id === act!.id).map((e) => e.id));
      act.served = act.served.filter((id) => answeredIds.has(id));
      // Ohne Antwort wird nicht fortgesetzt (wie auf Heute): Der neue Satz bekommt die aktuelle Satzgröße
      if (answeredIds.size === 0 || answeredIds.size >= act.size) act = null;
    }
    if (act) {
      activeRef.current = act;
      setSetId(act.id);
    } else {
      startSet();
    }
    loadNext();
    return () => {
      animTimers.current.forEach((t) => window.clearTimeout(t));
      destroyBoard();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Töne bei Berührung des Bretts
  const onSelectSquare = (key: Key) => {
    const g = cg.current;
    if (!g || phaseRef.current !== 'ask' || !liveRef.current) return;
    const dests = g.state.movable.dests;
    const prev = g.state.selected;
    if (dests?.has(key)) {
      moved.current = false;
      dragOrig.current = key;
      play('select');
      return;
    }
    if (prev && dests && key !== prev && !dests.get(prev)?.includes(key)) play('illegal');
  };

  // Figur auf ein unzulässiges Feld gezogen und losgelassen: chessground meldet das nicht, deshalb hier prüfen
  useEffect(() => {
    const onUp = (e: Event) => {
      const orig = dragOrig.current;
      if (!orig) return;
      dragOrig.current = null;
      const g = cg.current;
      const pt = pointOf(e);
      if (!g || !pt || phaseRef.current !== 'ask') return;
      const key = g.getKeyAtDomPos(pt);
      window.setTimeout(() => {
        if (moved.current) {
          moved.current = false;
          return;
        }
        if (!key || key === orig) return;
        const dests = cg.current?.state.movable.dests;
        if (dests && !dests.get(orig as Key)?.includes(key)) play('illegal');
      }, 0);
    };
    document.addEventListener('mouseup', onUp, true);
    document.addEventListener('touchend', onUp, true);
    return () => {
      document.removeEventListener('mouseup', onUp, true);
      document.removeEventListener('touchend', onUp, true);
    };
  }, []);

  // Brett aufbauen bzw. neue Aufgabe setzen. Mit letztem Zug: erst die Stellung davor, dann der Zug des Gegners, dann wird freigegeben.
  useEffect(() => {
    const ex = current?.ex;
    if (!ex || !boardEl.current) return;
    const pos = positionOf(ex.fen);
    const color = ex.turn === 'w' ? 'white' : 'black';
    const last = getState().settings.showLast ? ex.prev : undefined;
    const lastSq = last ? lastSquares(ex) : undefined;
    const common = {
      orientation: color,
      coordinates: true,
      blockTouchScroll: true,
      animation: { enabled: true, duration: 260 },
      highlight: { lastMove: true, check: true },
      premovable: { enabled: false },
      drawable: { enabled: true, visible: true, autoShapes: [] as DrawShape[] },
      events: { select: (key: Key) => onSelectSquare(key) },
    };
    const locked = {
      turnColor: color === 'white' ? 'black' : 'white',
      check: false,
      lastMove: undefined,
      draggable: { enabled: false },
      selectable: { enabled: false },
      movable: { free: false, color: undefined, dests: new Map(), events: { after: (orig: Key, dest: Key) => onUserMove(orig as SquareName, dest as SquareName) } },
    };
    const unlocked = {
      turnColor: color,
      check: pos.isCheck(),
      lastMove: lastSq as never,
      draggable: { enabled: true, showGhost: true },
      selectable: { enabled: true },
      movable: { free: false, color, dests: destsOf(pos) as never, showDests: true, events: { after: (orig: Key, dest: Key) => onUserMove(orig as SquareName, dest as SquareName) } },
    };
    resultShapes.current = [];
    setLive(false);
    const goLive = () => {
      cg.current?.set({ ...unlocked, fen: ex.fen } as never);
      shownAt.current = performance.now();
      shownWall.current = Date.now();
      setLive(true);
      if (startCue(getPrefs().timerSound, getState().settings.timeLimit)) play('start');
    };
    const timers: number[] = [];
    const start = last ? { ...common, ...locked, fen: last.board } : { ...common, ...unlocked, fen: ex.fen };
    if (!cg.current) cg.current = Chessground(boardEl.current, start as never);
    else cg.current.set(start as never);
    if (last) {
      timers.push(
        window.setTimeout(() => {
          play(last.san.includes('x') ? 'capture' : 'move');
          cg.current?.set({ fen: ex.fen, lastMove: lastSq as never, turnColor: color, check: pos.isCheck() } as never);
        }, 260),
        window.setTimeout(goLive, 260 + 340),
      );
    } else {
      goLive();
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Zeitanzeige und Uhr-Töne: Die Zeit läuft erst, wenn das Brett freigegeben ist
  useEffect(() => {
    if (phase !== 'ask' || !current || !live) return;
    let lastSec = 0;
    const id = window.setInterval(() => {
      const el = performance.now() - shownAt.current;
      setElapsed(el);
      const sec = Math.floor(el / 1000);
      if (sec - lastSec > 2) lastSec = sec - 1; // nach einer Pause nicht alle verpassten Ticks nachholen
      while (lastSec < sec) {
        lastSec++;
        const cue = timerCue(getPrefs().timerSound, getState().settings.timeLimit, lastSec);
        if (cue) play(cue.sfx, { gain: cue.gain });
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, current, live]);

  const lockBoard = () => {
    cg.current?.set({ movable: { color: undefined, dests: new Map() } as never, draggable: { enabled: false } });
  };

  /** Brett zurück in die Ausgangsstellung mit den Pfeilen (nach der Widerlegung oder wenn sie übersprungen wird) */
  const settleBoard = () => {
    const e = curRef.current;
    if (!e) return;
    cg.current?.set({ fen: e.fen, lastMove: shownLast(e), drawable: { autoShapes: resultShapes.current } } as never);
  };

  const cancelAnim = (settle = true) => {
    animTimers.current.forEach((t) => window.clearTimeout(t));
    animTimers.current = [];
    if (animatingRef.current) {
      animatingRef.current = false;
      setAnimating(false);
      if (settle) settleBoard();
    }
  };

  /** Zeigt nach einem falschen Zug, wie der Gegner ihn bestraft: seine Antwort und die nächsten Züge, dann zurück zur Aufgabe. */
  const startRefutation = (e: Exercise, san: string, pv: string[]) => {
    const steps = walkVariation(e.fen, [san, ...pv.slice(0, 3)]);
    if (steps.length < 3) {
      settleBoard();
      return;
    }
    animatingRef.current = true;
    setAnimating(true);
    cg.current?.set({ drawable: { autoShapes: [] } } as never);
    let t = 1000; // erst den eigenen Zug stehen lassen
    for (let i = 2; i < steps.length; i++) {
      const st = steps[i];
      const tok = [san, ...pv][i - 1] ?? '';
      animTimers.current.push(
        window.setTimeout(() => {
          cg.current?.set({ fen: st.fen, lastMove: st.lastMove as never } as never);
          play(tok.includes('x') ? 'capture' : 'move');
        }, t),
      );
      t += 800;
    }
    animTimers.current.push(window.setTimeout(() => cancelAnim(true), t + 700));
  };

  const shownLast = (e: Exercise | null) => (e && getState().settings.showLast ? lastSquares(e) : undefined) as never;

  const showShapes = (shapes: DrawShape[], resetFen?: string) => {
    resultShapes.current = shapes;
    cg.current?.set({ ...(resetFen ? { fen: resetFen, lastMove: shownLast(curRef.current) } : {}), drawable: { autoShapes: shapes } } as never);
  };

  const record = (ex: Exercise, verdict: Verdict, grade: Grade, ms: number, san: string | null, judgement: Judgement | null) => {
    const now = new Date();
    const act = activeRef.current;
    const rec = applyReview(getState().cards[ex.id], grade, now);
    const entry: ReviewEntry = {
      id: ex.id,
      ts: now.getTime(),
      grade,
      verdict,
      ms,
      // schon hier begrenzen: Beim Abgleich gewinnt die längere Dauer, eine spätere Begrenzung käme sonst nie an
      dur: Math.min(ms, MAX_DUR_MS),
      lim: getState().settings.timeLimit,
      dv: dataVersion,
      san: san ?? undefined,
      ...(act ? { set: { id: act.id, n: act.size } } : {}),
    };
    update((s) => ({ ...s, cards: { ...s.cards, [ex.id]: rec }, log: [...s.log, entry] }));
    setResult({ verdict, judgement, san, ms, grade, nextDue: dueDate(rec), ts: entry.ts });
    setPhase('result');
    // "Lösung zeigen" bei offener Umwandlungswahl: die Auswahl würde sonst das Brett mit der Lösung verdecken
    setPromo(null);
    lockBoard();
  };

  const finishMove = (orig: SquareName, dest: SquareName, role?: Role) => {
    const ex = curRef.current;
    if (!ex || phaseRef.current !== 'ask') return;
    const pos = positionOf(ex.fen);
    const san = sanOfMove(pos, orig, dest, role);
    if (!san) {
      cg.current?.set({ fen: ex.fen, lastMove: shownLast(ex) } as never);
      play('illegal');
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
    // Was der Gegner gedroht hat, nur nach einem falschen Zug und nur bei Fehlern, die eine Drohung übersehen
    if (!j.correct && ex.threat && THREAT_CATS.has(ex.cat)) {
      const [tf, tt] = uciSquares(ex.threat.uci);
      shapes.push(shape(tf, tt, 'paleRed'));
    }
    record(ex, j.verdict, grade, ms, san, j);
    play(j.correct ? (grade === 2 ? 'slow' : 'correct') : 'wrong');
    const ref = j.verdict === 'wrong' ? ex.refs?.find((r) => r[0] === san) : undefined;
    if (j.correct) showShapes(shapes);
    else if (ref) {
      // erst die Widerlegung vorführen, danach erscheinen die Pfeile
      resultShapes.current = shapes;
      startRefutation(ex, san, ref[1]);
    } else showShapes(shapes, ex.fen);
  };

  const onUserMove = (orig: SquareName, dest: SquareName) => {
    const ex = curRef.current;
    if (!ex || phaseRef.current !== 'ask') return;
    moved.current = true;
    const pos = positionOf(ex.fen);
    play(isCapture(pos, orig, dest) ? 'capture' : 'move');
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
    play('wrong', { gain: 0.7 });
    showShapes([shape(bf, bt, 'green')], ex.fen);
  };

  /** Gesamtzeit mit der Aufgabe nachtragen, sobald man sie verlässt */
  const commitDur = () => {
    const r = result;
    const ex = current?.ex;
    if (r && ex && !durDone.current) {
      durDone.current = true;
      const dur = Math.min(MAX_DUR_MS, Date.now() - shownWall.current);
      update((s) => ({
        ...s,
        log: s.log.map((e) => (e.id === ex.id && e.ts === r.ts ? { ...e, dur } : e)),
      }));
    }
  };

  const next = () => {
    cancelAnim(false);
    commitDur();
    loadNext();
  };

  const hideAndNext = () => {
    const ex = curRef.current;
    if (ex) update((s) => ({ ...s, hidden: { ...s.hidden, [ex.id]: { on: true, ts: Date.now() } } }));
    next();
  };

  const requestExit = () => {
    cancelAnim(false);
    commitDur();
    if (summary || finished || !activeRef.current) {
      if (finished) saveActive(null);
      onExit();
      return;
    }
    if (answered === 0) {
      saveActive(null);
      onExit();
      return;
    }
    if (answered >= activeRef.current.size) {
      showSummary();
      return;
    }
    setConfirmExit(true);
  };

  const nextSet = () => {
    startSet();
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
      if (pv.step > 0) {
        const tok = current.ex.lines[pv.line].pv[pv.step - 1] ?? '';
        play(tok.includes('x') ? 'capture' : 'move');
      }
    } else if (phase === 'result') {
      cg.current.set({ fen: current.ex.fen, lastMove: shownLast(current.ex), drawable: { autoShapes: resultShapes.current } } as never);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pv?.line, pv?.step]);

  const ex = current?.ex ?? null;
  const limit = settings.timeLimit;
  const explanation = ex ? explain(ex, settings.tolerance) : [];
  const over = limit > 0 && elapsed > limit * 1000;
  const barPct = limit > 0 ? Math.min(100, (elapsed / (limit * 1000)) * 100) : 0;

  if (summary) {
    return (
      <SetResult
        summary={summary.s}
        entries={summary.entries}
        byId={byId}
        limit={limit}
        moreAvailable={summary.moreAvailable}
        onNext={nextSet}
        onExit={onExit}
      />
    );
  }

  if (finished || !ex) {
    // nur hier gebraucht: nicht bei jedem Uhr-Takt (zehnmal pro Sekunde) alle Übungen durchgehen
    const c = counts(exercises, state, new Date());
    const t = today(state.log, new Date());
    return (
      <section class="screen">
        <header class="topbar">
          <button class="link" onClick={requestExit}>
            ← Zurück
          </button>
        </header>
        <div class="card center">
          <h2>{c.total === 0 ? 'Keine Aufgaben im Filter' : 'Für heute ist alles erledigt'}</h2>
          <p class="muted">
            {c.total === 0
              ? 'Ändere den Filter in den Einstellungen.'
              : `Heute ${count(t.n, 'Aufgabe', 'Aufgaben')}${t.rate !== null ? `, ${pct(t.rate)} richtig` : ''}. ${
                  c.backlogDays > 0 ? 'Der Rest der Wiederholungen kommt an den nächsten Tagen dran.' : 'Neue Aufgaben kommen morgen, fällige Wiederholungen früher.'
                }`}
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
                startSet();
                loadNext();
              }}
            >
              5 weitere neue Aufgaben
            </button>
          )}
          <button class="btn" onClick={requestExit}>
            Fertig
          </button>
        </div>
      </section>
    );
  }

  const best = ex.lines[0];
  // "gleichwertig" wie in der Wertung: mit Toleranz bis TOLERANCE_WP, bei "Nur der beste" nur praktisch gleich gute Züge
  const alts = equalMoves(ex, settings.tolerance);
  const correctNow = result && isCorrect(result.verdict);
  const slow = result && correctNow && result.grade === 2;
  const lastOfSet = answered >= setSize;
  const refPv = result && result.verdict === 'wrong' ? ex.refs?.find((r) => r[0] === result.san)?.[1] : undefined;
  const refLine = refPv?.slice(0, 3).join(' ');
  const threatLine = result && !correctNow && result.verdict !== 'gaveup' && ex.threat && THREAT_CATS.has(ex.cat) ? ex.threat.san : null;
  const sameAsGame = !!result && !correctNow && result.verdict !== 'gaveup' && result.san === ex.played.san;
  const taskNo = Math.min(setSize, phase === 'ask' ? answered + 1 : answered);

  return (
    <section class="screen trainer">
      <header class="topbar">
        <button class="link" onClick={requestExit} aria-label="Training beenden">
          ← Beenden
        </button>
        <div class="counts" aria-label="Fortschritt im Satz">
          <span>
            Aufgabe {n0(taskNo)} von {n0(setSize)}
          </span>
        </div>
      </header>
      <SetBar size={setSize} entries={setEntries} open={phase === 'ask'} />

      <div class="prompt">
        <span class={`side ${ex.turn}`}>{sideName(ex.turn)} am Zug</span>
        <span class="tag">{KIND_TEXT[current!.kind]}</span>
        <span class="tag">{ex.phase}</span>
        {settings.showLast && lastMoveLabel(ex) && (
          <span class="tag last" title="Letzter Zug des Gegners">
            Gegner: <b class="mono">{lastMoveLabel(ex)}</b>
          </span>
        )}
      </div>

      <div class="board-wrap" data-live={live ? '1' : '0'} data-ex={ex.id}>
        <div ref={boardEl} class="board" role="img" aria-label={`Schachstellung, ${sideName(ex.turn)} am Zug`} />
        {animating && <div class="skip-anim" onClick={() => cancelAnim(true)} aria-hidden="true" />}
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
          <button class="btn secondary" onClick={giveUp} disabled={!live}>
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
              {yourMoveText(result.judgement, ex.more !== undefined)}
            </p>
          )}
          <p>
            Bester Zug: <b class="mono good-text">{best.san}</b> · {n0(best.wp)} % Gewinnchance
            {alts.length > 0 && (
              <span class="muted">
                {' '}
                · gleichwertig: {alts.slice(0, 5).map((a) => a.san).join(', ')}
                {alts.length > 5 ? ' …' : ''}
              </span>
            )}
          </p>
          {refLine && (
            <p>
              Nach <b class="mono">{result.san}</b> folgt <span class="mono">{refLine}</span>.
            </p>
          )}
          {threatLine && (
            <p>
              Der Gegner drohte: <b class="mono">{threatLine}</b> (blasser Pfeil).
            </p>
          )}
          {sameAsGame && <p class="muted">Derselbe Zug wie in der Partie. Dieser Reflex ist es, den du hier umlernst.</p>}
          <p class="muted">
            In der Partie gespielt: <span class="mono">{ex.played.san}</span> ({n0(ex.played.wp)} %, {n0(ex.loss)} Prozentpunkte weniger
            als der beste Zug).
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
            <div class="pv" data-nosound>
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
              <button
                class="btn secondary"
                onClick={() => {
                  cancelAnim(false);
                  setPv({ line: 0, step: 0 });
                }}
              >
                Variante ansehen
              </button>
              <a class="btn secondary" href={ex.url} target="_blank" rel="noopener noreferrer">
                Partie ansehen
              </a>
            </div>
          )}
        </div>
      )}

      {phase === 'result' && result && (
        <div class="dock">
          <button class="btn" onClick={next}>
            {lastOfSet ? 'Ergebnis ansehen' : 'Weiter'}
          </button>
          <button class="link muted" onClick={hideAndNext}>
            Diese Aufgabe nicht mehr zeigen
          </button>
        </div>
      )}

      {confirmExit && (
        <div class="modal" role="dialog" aria-modal="true" aria-label="Satz beenden">
          <div class="modal-card">
            <h2>Satz beenden?</h2>
            <p class="muted">
              Du hast {n0(answered)} von {n0(setSize)} Aufgaben beantwortet. Deine Antworten sind schon gezählt.
            </p>
            <button
              class="btn"
              onClick={() => {
                setConfirmExit(false);
                onExit();
              }}
            >
              Später weitermachen
            </button>
            <button
              class="btn secondary"
              onClick={() => {
                setConfirmExit(false);
                showSummary();
              }}
            >
              Beenden und Ergebnis ansehen
            </button>
            <button class="link" onClick={() => setConfirmExit(false)}>
              Zurück zur Aufgabe
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
