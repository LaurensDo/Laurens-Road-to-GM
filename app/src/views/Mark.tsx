/** Der Bauer aus dem App-Symbol, in der Textfarbe gezeichnet. */
export function PawnMark({ class: cls }: { class?: string }) {
  return (
    <svg class={cls} viewBox="96 120 320 320" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <circle cx="256" cy="168" r="48" />
        <path d="M226 212 h60 l22 28 H204 z" />
        <path d="M214 240 H298 C312 292 332 322 340 352 H172 C180 322 200 292 214 240 Z" />
        <rect x="148" y="350" width="216" height="38" rx="12" />
        <rect x="128" y="392" width="256" height="32" rx="14" />
      </g>
    </svg>
  );
}
