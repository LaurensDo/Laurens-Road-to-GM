const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const n0 = (x: number) => nf0.format(x);
export const n1 = (x: number) => nf1.format(x);
export const pct = (x: number) => `${nf0.format(x)} %`;
/** Zahl mit passendem Wort: "1 Aufgabe", "3 Aufgaben" */
export const count = (x: number, one: string, many: string) => `${nf0.format(x)} ${x === 1 ? one : many}`;

export function seconds(ms: number): string {
  return `${nf1.format(ms / 1000)} s`;
}

/** "in 10 Min", "in 5 Std", "morgen", "in 3 Tagen" */
export function inWords(from: Date, to: Date): string {
  const min = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
  if (min < 1) return 'gleich';
  if (min < 60) return `in ${min} Min`;
  const h = Math.round(min / 60);
  if (h < 24) return `in ${h} Std`;
  // ab einem Tag nach Kalendertagen: Abends um elf sind 26 Stunden schon übermorgen
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const d = Math.round((day(to) - day(from)) / 86400000);
  return d <= 1 ? 'morgen' : `in ${d} Tagen`;
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Tag `back` Kalendertage vor `now`. Rechnet mit Kalendertagen statt mit 24 Stunden: An den Tagen der Zeitumstellung
 * (23 oder 25 Stunden) würde sonst ein Tag doppelt gezählt oder ausgelassen.
 */
export function dayKeyBefore(now: Date, back: number): string {
  return dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back, 12).getTime());
}

export function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

export function dateLabel(iso: string): string {
  // reines Datum als Ortszeit lesen (new Date('2026-07-12') wäre Mitternacht UTC, westlich davon der Vortag)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}
