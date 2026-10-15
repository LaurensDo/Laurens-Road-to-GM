const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const n0 = (x: number) => nf0.format(x);
export const n1 = (x: number) => nf1.format(x);
export const pct = (x: number) => `${nf0.format(x)} %`;

export function seconds(ms: number): string {
  return `${nf1.format(ms / 1000)} s`;
}

/** "in 10 Min", "in 3 Tagen" */
export function inWords(from: Date, to: Date): string {
  const min = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
  if (min < 1) return 'gleich';
  if (min < 60) return `in ${min} Min`;
  const h = Math.round(min / 60);
  if (h < 24) return `in ${h} Std`;
  const d = Math.round(h / 24);
  return d === 1 ? 'morgen' : `in ${d} Tagen`;
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}
