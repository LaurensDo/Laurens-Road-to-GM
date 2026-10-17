/** Version dieser App (aus package.json) und Stufe, bis zu der sie Sync-Dateien lesen kann. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

/**
 * Lese-Stufe des Dateiformats. Eine Sync-Datei trägt `minReader`: Erst Geräte mit mindestens dieser Stufe dürfen sie lesen und
 * schreiben. Ältere Geräte lehnen sie ab und lassen sie unberührt, statt Felder zu verlieren. Neue Stufe nur, wenn sich das
 * Format so ändert, dass ältere Versionen es falsch lesen würden.
 */
export const READER_LEVEL = 1;

/** Vergleicht Versionen wie "1.2.0" und "1.10.0" zahlenweise. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}
