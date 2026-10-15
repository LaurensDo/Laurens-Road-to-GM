import kingUrl from '../assets/brand/king.svg';

/** Markenzeichen: der Bulldoggen-König (schwarz, heller Rand, goldene Krone). Erzeugt mit tools/brand.mjs. */
export function KingMark({ class: cls }: { class?: string }) {
  return <img class={cls} src={kingUrl} alt="" aria-hidden="true" draggable={false} />;
}
