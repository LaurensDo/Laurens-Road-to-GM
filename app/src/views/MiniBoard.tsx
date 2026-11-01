import { useEffect, useRef } from 'preact/hooks';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import { walkVariation } from '../lib/chess';

/** Kleines Brett ohne Eingabe: die Stellung nach einem Zug, mit hervorgehobenem Zug (Moment des Satzes). */
export function MiniBoard({ fen, san, orientation }: { fen: string; san: string; orientation: 'white' | 'black' }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const after = walkVariation(fen, [san])[1];
    const api: Api = Chessground(el.current, {
      fen: after?.fen ?? fen,
      orientation,
      viewOnly: true,
      coordinates: false,
      animation: { enabled: false },
      drawable: { enabled: false, visible: false },
      ...(after?.lastMove ? { lastMove: after.lastMove } : {}),
    } as never);
    return () => api.destroy();
  }, [fen, san, orientation]);
  return (
    <div class="mini-board">
      <div ref={el} class="board" role="img" aria-label={`Stellung nach ${san}`} />
    </div>
  );
}
